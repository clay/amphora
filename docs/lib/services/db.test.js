'use strict';

const _ = require('lodash'),
  filename = __filename.split('/').pop().split('.').shift(),
  lib = require('./' + filename),
  plugins = require('../plugins'),
  bluebird = require('bluebird'),
  expect = require('chai').expect,
  sinon = require('sinon');

describe(_.startCase(filename), function () {
  let sandbox;

  beforeEach(function () {
    sandbox = sinon.sandbox.create();
    sandbox.stub(plugins, 'executeHook');
    return lib.clear();
  });

  afterEach(function () {
    sandbox.restore();
    lib.off();
  });

  after(function () {
    return lib.clear();
  });

  it('can put and get strings', function () {
    return lib.put('1', '2').then(function () {
      return lib.get('1');
    }).done(function (result) {
      expect(result).to.equal('2');
    });
  });

  it('can put and get event', function () {
    const spy = sandbox.spy();

    lib.on('put', spy);

    return lib.put('1', '2').then(function () {
      sinon.assert.calledOnce(spy);
    });
  });

  it('can put and del strings', function () {
    return lib.put('1', '2').then(function () {
      return lib.del('1');
    }).done(function (result) {
      expect(result).to.equal(undefined);
    });
  });

  it('cannot get deleted strings', function (done) {
    lib.put('1', '2').then(function () {
      return lib.del('1');
    }).then(function () {
      return lib.get('1');
    }).done(done, function (err) {
      expect(err.name).to.equal('NotFoundError');
      done();
    });
  });

  it('can batch and get event', function () {
    const spy = sandbox.spy();

    lib.on('batch', spy);

    return lib.batch([{type: 'put', key: 'a', value: 'b'}]).then(function () {
      sinon.assert.calledOnce(spy);
    });
  });

  describe('put', function () {
    const fn = lib[this.title];

    it('executes save plugin hook', function () {
      return fn('key','val').then(() => {
        expect(plugins.executeHook.firstCall.args).to.deep.equal([
          'save', [{type: 'put', key: 'key', value: 'val'}]
        ]);
      });
    });
    it('executes only save plugin hook for @published', function () {
      return fn('/pages/key@published','val').then(() => {
        expect(plugins.executeHook.firstCall.args).to.deep.equal([
          'save', [{type: 'put', key: '/pages/key@published', value: 'val'}]
        ]);
        expect(plugins.executeHook.callCount).to.equal(1);
      });
    });
  });

  describe('batch', function () {
    const fn = lib[this.title];

    it('executes save plugin hook', function () {
      const ops = [{type: 'put', key: 'key', value: 'val'}];

      return fn(ops).then(() => {
        expect(plugins.executeHook.firstCall.args).to.deep.equal([
          'save', ops
        ]);
      });
    });
    it('executes only save plugin hook if not a page publish batch', function () {
      const ops = [{type: 'put', key: 'key@published', value: 'val'}];

      return fn(ops).then(() => {
        expect(plugins.executeHook.firstCall.args).to.deep.equal([
          'save', ops
        ]);
        expect(plugins.executeHook.callCount).to.equal(1);
      });
    });
    it('executes only save plugin hook if only one put operation', function () {
      const ops = [
        {type: 'put', key: '/pages/key@published', value: 'val'}
      ];

      return fn(ops).then(() => {
        expect(plugins.executeHook.firstCall.args).to.deep.equal([
          'save', ops
        ]);
        expect(plugins.executeHook.callCount).to.equal(1);
      });
    });
    it('executes save and publish plugin hooks for page publish batch', function () {
      const ops = [
        {type: 'put', key: 'key@published', value: 'val'},
        {type: 'put', key: '/pages/key@published', value: 'val'}
      ];

      return fn(ops).then(() => {
        expect(plugins.executeHook.firstCall.args).to.deep.equal([
          'save', ops
        ]);
        expect(plugins.executeHook.secondCall.args).to.deep.equal([
          'publish', {
            uri: '/pages/key@published',
            ops: ops
          }
        ]);
      });
    });
  });

  describe('del', function () {
    const fn = lib[this.title];

    it('executes delete plugin hook', function () {
      return fn('key','val').then(() => {
        expect(plugins.executeHook.firstCall.args).to.deep.equal([
          'delete', [{type: 'del', key: 'key', value: 'val'}]
        ]);
      });
    });
  });

  describe('clear', function () {
    const fn = lib[this.title];

    it('handles db errors as promise', function (done) {
      let on, mockOn;

      // fake pipe;
      on = _.noop;
      on.on = on;
      sandbox.stub(lib.getDB(), 'createReadStream', _.constant(on));
      mockOn = sandbox.mock(on);
      mockOn.expects('on').withArgs('data', sinon.match.func).yields('some data').exactly(1).returns(on);
      mockOn.expects('on').withArgs('error', sinon.match.func).yields('whatever').exactly(1).returns(on);
      mockOn.expects('on').withArgs('end', sinon.match.func).yields().exactly(1).returns(on);

      fn().done(done, function () {
        sandbox.verify();
        done();
      });
    });

    it('deletes all records', function () {
      return lib.put('1', '2').then(function () {
        return fn();
      }).then(function () {
        return bluebird.settle([lib.get('1'), lib.get('2')]);
      }).spread(function (get1, get2) {

        expect(get1.isRejected()).to.equal(true);
        expect(get2.isRejected()).to.equal(true);

      });
    });
  });

  describe('list', function () {
    const fn = lib[this.title];

    it('default behaviour', function () {
      return bluebird.join(lib.put('1', '2'), lib.put('3', '4'), lib.put('5', '6'))
        .then(function () {
          return lib.pipeToPromise(fn());
        }).then(function (str) {
          expect(str).to.equal('{"1":"2","3":"4","5":"6"}');
        });
    });

    it('can get keys-only in array structure', function () {
      return bluebird.join(lib.put('1', '2'), lib.put('3', '4'), lib.put('5', '6'))
        .then(function () {
          return lib.pipeToPromise(fn({keys: true, values: false}));
        }).then(function (str) {
          expect(str).to.equal('["1","3","5"]');
        });
    });

    it('can get values-only in array structure', function () {
      return bluebird.join(lib.put('1', '2'), lib.put('3', '4'), lib.put('5', '6'))
        .then(function () {
          return lib.pipeToPromise(fn({keys: false, values: true}));
        }).then(function (str) {
          expect(str).to.equal('["2","4","6"]');
        });
    });

    it('can get key-value in object structure in array', function () {
      return bluebird.join(lib.put('1', '2'), lib.put('3', '4'), lib.put('5', '6'))
        .then(function () {
          return lib.pipeToPromise(fn({isArray: true}));
        }).then(function (str) {
          expect(str).to.equal('[{"key":"1","value":"2"},{"key":"3","value":"4"},{"key":"5","value":"6"}]');
        });
    });

    it('can return empty data safely for arrays', function () {
      return lib.pipeToPromise(fn({isArray: true})).then(function (str) {
        expect(str).to.equal('[]');
      });
    });

    it('can return empty data safely for objects', function () {
      return lib.pipeToPromise(fn({isArray: false})).then(function (str) {
        expect(str).to.equal('{}');
      });
    });

    it('can stream an object instead of a JSON string', function (done) {
      const onData = (data) => expect(data).to.deep.equal({key: '1', value: '2'}),
        onEnd = () => done(),
        onError = done;

      lib.put('1', '2')
        .then(()=>{
          const pipe = fn({
            json: false
          });

          pipe.on('data', onData);
          pipe.on('end', onEnd);
          pipe.on('error', onError);
        });
    });
  });

  describe('formatBatchOperations', function () {
    const fn = lib[this.title];

    it('does not throw on empty batch', function () {
      expect(function () {
        fn([]);
      }).to.not.throw();
    });

    it('does not throw on single operation', function () {
      expect(function () {
        fn([{type: 'put', key: 'a', value: '{}'}]);
      }).to.not.throw();
    });

    it('does not throw on non-object value', function () {
      expect(function () {
        fn([{type: 'put', key: 'a', value: 'str'}]);
      }).to.not.throw();
    });

    it('does not throw on large object value', function () {
      expect(function () {
        const obj = {};

        function setIndex(index) {
          obj[index] = index;
        }

        _.times(100, setIndex);

        fn([{type: 'put', key: 'a', value: JSON.stringify(obj)}]);
      }).to.not.throw();
    });
  });

  describe('setDB', function () {
    const fn = lib[this.title];

    it('sets', function () {
      expect(function () {
        fn(lib.getDB());
      }).to.not.throw();
    });
  });
});
