'use strict';
/* eslint max-nested-callbacks:[2,5] */

var _ = require('lodash'),
  sinon = require('sinon'),
  expect = require('chai').expect,
  filename = __filename.split('/').pop().split('.').shift(),
  lib = require('./' + filename);

/**
 * Create a fake elasticsearch client.
 * @returns {*}
 */
function createFakeClientClass() {
  return {
    bulk: _.noop,
    search: _.noop,
    delete: _.noop,
    index: _.noop,
    ping: _.noop,
    search: _.noop,
    indices: {
      delete: _.noop,
      exists: _.noop,
      existsAlias: _.noop,
      putAlias: _.noop,
      create: _.noop,
      getMapping: _.noop,
      putMapping: _.noop
    }
  };
}

describe(_.startCase(filename), function () {
  var sandbox,
    client = createFakeClientClass();

  beforeEach(function () {
    sandbox = sinon.sandbox.create();
    sandbox.stub(client);
    sandbox.stub(client.indices);
    lib.setup(client);
  });

  afterEach(function () {
    sandbox.restore();
  });

  // setup
  describe('setup', function () {
    it('creates an Elastic client if an endpoint is defined and no override is passed in', function () {
      var result = function () {
        lib.setup();
      };

      expect(result).to.throw(Error);
    });

    it('returns an instance with fake client if one is passed in', function () {
      lib.setup(client);
      expect(lib.client).to.deep.equal(client);
    });

    it('creates an Elastic client if an endpoint is defined and no override is passed in', function () {
      lib.endpoint = 'whatever';
      lib.setup();
      expect(lib.client).to.not.deep.equal({});
    });
  });

  // healthCheck
  describe('healthCheck', function () {
    var fn = lib[this.title];

    it('pings unsuccessfully', function () {
      client.ping.returns(Promise.reject(new Error('failed')));
      return fn(client).catch(function (resp) {
        expect(resp).to.be.an.instanceof(Error);
      });
    });

    it('pings successfully', function () {
      client.ping.returns(Promise.resolve());
      return fn(client).then(function (resp) {
        expect(resp).to.be.undefined;
      });
    });
  });

  // existsMapping
  describe('existsMapping', function () {
    var fn = lib[this.title];

    it('is called successfully', function () {
      client.indices.getMapping.returns(Promise.resolve(true));
      return fn('index', 'type')
        .then(function () {
          expect(client.indices.getMapping.calledOnce).to.be.true;
        });
    });
  });

  // initIndex
  describe('initIndex', function () {
    var fn = lib[this.title];

    it('is called successfully', function () {
      client.indices.create.returns(Promise.resolve(true));
      return fn('index', 'mappings')
        .then(function () {
          expect(client.indices.create.calledOnce).to.be.true;
        });
    });

    it('handles error properly', function () {
      client.indices.create.returns(Promise.reject(false));
      return fn('index', 'mappings')
        .catch(function () {
          expect(client.indices.create.calledOnce).to.be.true;
        });
    });
  });

  // initAlias
  describe('initAlias', function () {
    var fn = lib[this.title];

    it('is called successfully', function () {
      client.indices.putAlias.returns(Promise.resolve(true));
      return fn('name', 'index')
        .then(function () {
          expect(client.indices.putAlias.calledOnce).to.be.true;
        });
    });

    it('handles error properly', function () {
      client.indices.putAlias.returns(Promise.reject(false));
      return fn('name', 'index')
        .catch(function () {
          expect(client.indices.putAlias.calledOnce).to.be.true;
        });
    });
  });

  // initMapping
  describe('initMapping', function () {
    var fn = lib[this.title];

    it('is called successfully', function () {
      client.indices.putMapping.returns(Promise.resolve(true));
      return fn('name', 'index')
        .then(function () {
          expect(client.indices.putMapping.calledOnce).to.be.true;
        });
    });

    it('handles error properly', function () {
      client.indices.putMapping.returns(Promise.reject(false));
      return fn('name', 'index')
        .catch(function (resp) {
          expect(resp).to.be.false;
        });
    });
  });

  // createAliasIfNone
  describe('createAliasIfNone', function () {
    var fn = lib[this.title];

    it('calls existsAlias successfully', function () {
      sandbox.stub(lib, 'existsAlias').returns(Promise.resolve(true));
      return fn('index')
        .then(function () {
          expect(lib.existsAlias.calledOnce).to.be.true;
        });
    });

    it('calls initAlias successfully', function () {
      sandbox.stub(lib, 'existsAlias').returns(Promise.resolve(false));
      sandbox.stub(lib, 'initAlias').returns(Promise.resolve(true));
      return fn('index')
        .then(function () {
          return lib.initAlias()
            .then(function (resp) {
              expect(resp).to.be.true;
            });
        });
    });

    it('calls initAlias successfully and catches if rejected', function () {
      sandbox.stub(lib, 'existsAlias').returns(Promise.resolve(false));
      sandbox.stub(lib, 'initAlias').returns(Promise.reject(false));
      return fn('index')
        .then(function () {
          return lib.initAlias()
            .catch(function (resp) {
              expect(resp).to.be.false;
            });
        });
    });
  });

  // createMappingIfNone
  describe('createMappingIfNone', function () {
    var fn = lib[this.title];

    it('calls existsMapping successfully', function () {
      sandbox.stub(lib, 'existsMapping').returns(Promise.resolve({ 'index.mappings.type': [1, 2, 3] }));
      sandbox.stub(lib, 'initMapping').returns(Promise.resolve(true));
      return fn('index', 'type', 'mapping')
        .then(function () {
          expect(lib.existsMapping.calledOnce).to.be.true;
        });
    });

    it('calls initMapping successfully', function () {
      sandbox.stub(lib, 'existsMapping').returns(Promise.resolve());
      sandbox.stub(lib, 'initMapping').returns(Promise.resolve(true));
      return fn('index', 'type', 'mapping')
        .then(function () {
          expect(lib.initMapping.called).to.be.true;
        });
    });

    it('catches on initMapping if there is a rejection', function () {
      sandbox.stub(lib, 'existsMapping').returns(Promise.resolve());
      sandbox.stub(lib, 'initMapping').returns(Promise.reject(false));
      return fn('index', 'type', 'mapping')
        .then(function () {
          expect(lib.initMapping.called).to.be.true;
        });
    });
  });

  // createIndexName
  describe('createIndexName', function () {
    var fn = lib[this.title];

    it('returns a string', function () {
      expect(fn('alias')).be.equal('alias_v1');
    });
  });

  // createIndexIfNone
  describe('createIndexIfNone', function () {
    var fn = lib[this.title];

    it('calls the createIndexIfNone method', function () {
      client.indices.exists.returns(Promise.resolve(true));
      return fn('index')
        .then(function () {
          expect(client.indices.exists.calledOnce).to.be.true;
        });
    });

    it('calls the initIndex function', function () {
      client.indices.exists.returns(Promise.resolve(false));
      sandbox.stub(lib, 'initIndex').returns(Promise.resolve(true));
      return fn('index')
        .then(function () {
          return lib.initIndex()
            .then(function (resp) {
              expect(resp).to.be.true;
            });
        });
    });

    it('when initIndex is called it will catch if it is rejected', function () {
      client.indices.exists.returns(Promise.resolve(false));
      sandbox.stub(lib, 'initIndex').returns(Promise.reject(false));
      return fn('index')
        .then(function () {
          return lib.initIndex()
            .catch(function (resp) {
              expect(resp).to.be.false;
            });
        });
    });
  });

  // Exists Index
  describe('existsIndex', function () {
    var fn = lib[this.title];

    it('calls the existsIndex method provided by the ES client', function () {
      client.indices.exists.returns(Promise.resolve('ES Client `existsIndex` called'));
      return fn('name')
        .then(function () {
          expect(client.indices.exists.calledOnce).to.be.true;
        });
    });
  });

  // Exists Alias
  describe('existsAlias', function () {
    var fn = lib[this.title];

    it('calls the existsAlias method provided by the ES client', function () {
      client.indices.existsAlias.returns(Promise.resolve('ES Client `existsAlias` called'));
      return fn('name')
        .then(function () {
          expect(client.indices.existsAlias.calledOnce).to.be.true;
        });
    });
  });

  describe('query', function () {
    var fn = lib[this.title];

    it('calls the search method provided by the ES client', function () {
      client.search.returns(Promise.resolve());
      return fn('index', 'query', 'type')
        .then(function () {
          expect(client.search.calledOnce).to.be.true;
        });
    });

    it('handles successful queries', function () {
      client.search.returns(Promise.resolve('search query successful'));
      return fn('index', 'query', 'type')
        .then(function () {
          expect(true).to.be.true;
        });
    });

    it('handles failed queires', function () {
      client.search.returns(Promise.reject(false));
      return fn('index', 'query', 'type')
        .catch(function (resp) {
          expect(resp).to.be.false;
        });
    });
  });

  // Delete
  describe('del', function () {
    var fn = lib[this.title];

    it('calls the delete method provided by the ES client', function () {
      client.delete.returns(Promise.resolve('ES Client `delete` called'));
      return fn('index', 'type', 'some/ref')
        .then(function () {
          expect(client.delete.calledOnce).to.be.true;
        });
    });

    it('handles successful deletes', function () {
      client.delete.returns(Promise.resolve('search delete successful'));
      return fn('index', 'type', 'some/ref')
        .then(function () {
          expect(true).to.be.true;
        });
    });

    it('handles failed deletes', function () {
      client.delete.returns(Promise.reject(false));
      return fn('index', 'type', 'some/ref')
        .catch(function (resp) {
          expect(resp).to.be.false;
        });
    });
  });

  // Put
  describe('put', function () {
    var fn = lib[this.title];

    it('calls the index method provided by the ES client', function () {
      client.index.returns(Promise.resolve('ES Client `put` called'));
      return fn('index', 'type', 'some/ref')
        .then(function () {
          expect(client.index.calledOnce).to.be.true;
        });
    });

    it('handles successful puts', function () {
      client.index.returns(Promise.resolve('search put successful'));
      return fn('index', 'type', 'some/ref')
        .then(function () {
          expect(true).to.be.true;
        });
    });

    it('handles failed puts', function () {
      client.index.returns(Promise.reject('search put unsuccessful'));
      return fn('index', 'type', 'some/ref')
        .catch(function () {
          expect(false).to.be.false;
        });
    });
  });

  // convertRedisBatchtoElasticBatch
  describe('convertRedisBatchtoElasticBatch', function () {
    var fn = lib[this.title];

    it('throws error if op.value is a string', function () {
      var ops = [{ value: 'value' }],
        result = function () {
          fn('index', 'type', ops);
        };

      expect(result).to.throw(TypeError);
    });

    it('returns an array of ops if type property equals "put"', function () {
      var ops = [{ value: {}, type: 'put' }];

      expect(fn('index', 'type', ops)).to.deep.equal([{ index: { _index: 'index', _type: 'type' } }, {}]);
    });

    it('assigns a "key" property if one is defined in the op', function () {
      var ops = [{ value: {}, type: 'put', key: 'key' }];

      expect(fn('index', 'type', ops)).to.deep.equal([{ index: { _id: 'key', _index: 'index', _type: 'type' } }, {}]);
    });

    it('assigns a "key" property if one is defined in the op', function () {
      var ops = [{ value: {}, type: 'get', key: 'key' }];

      expect(fn('index', 'type', ops)).to.deep.equal([]);
    });
  });

  // batch
  describe('batch', function () {
    var fn = lib[this.title];

    it('calls bulk method successfully', function () {
      client.bulk.returns(Promise.resolve());
      return fn([])
        .then(function () {
          expect(client.bulk.calledOnce).to.be.true;
        });
    });

    it('bulk rejects and returns an Error if failed', function () {
      client.bulk.returns(Promise.resolve({ errors: true }));
      return fn([])
        .catch(function (error) {
          expect(error).to.be.an.instanceof(Error);
        });
    });
  });

  // batch
  describe('batch', function () {
    var fn = lib[this.title];

    it('calls bulk method successfully', function () {
      client.bulk.returns(Promise.resolve());
      return fn([])
        .then(function () {
          expect(client.bulk.calledOnce).to.be.true;
        });
    });

    it('bulk rejects and returns an Error if failed', function () {
      client.bulk.returns(Promise.resolve({ errors: true }));
      return fn([])
        .catch(function (error) {
          expect(error).to.be.an.instanceof(Error);
        });
    });
  });

  // RESTQuery
  describe('RESTQuery', function () {
    var fn = lib[this.title];

    it('calls the search method provided by the ES client', function () {
      client.search.returns(Promise.resolve());
      return fn()
        .then(function () {
          expect(client.search.calledOnce).to.be.true;
        });
    });
  });
});

