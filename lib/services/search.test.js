'use strict';
var _ = require('lodash'),
  filename = __filename.split('/').pop().split('.').shift(),
  lib = require('./' + filename),
  expect = require('chai').expect;

describe('Generic search switcher test', function () {

  beforeEach(function () {
    lib.setSearchEngine(null);
  });

  afterEach(function () {
    lib.setSearchEngine(null);
  });

  it('contains default list of functions', function () {
    expect(_.sortBy(Object.keys(lib), function (s) {
      return s;
    })).to.deep.equal([
      'batch',
      'createIndex',
      'del',
      'delByUri',
      'deleteIndices',
      'get',
      'getSearchIndex',
      'hasIndex',
      'put',
      'putByUri',
      'search',
      'searchBulk',
      'setSearchEngine']);
  });

  describe('setSearchEngine', function () {
    var fn = lib[this.title],
    fakeEngine = {
      get: function () {
        return 3;
      }
    };

    it('fakeEngine is set up', function () {
      expect(fakeEngine.get('')).to.equal(3);
    });

    it('Incomplete api will not validate', function () {
      expect(function () {
        fn(fakeEngine);
      }).to.throw();
    });
  });

});

describe('Switch to a complete mock search engine', function () {

  before(function () {
    const fakeEngine = {
      get: function () {
        return 1;
      },
      put: function () {
        return 2;
      },
      del: function () {
        return 3;
      },
      search: function () {
        return 4;
      },
      hasIndex: function () {
        return 5;
      },
      createIndex: function () {
        return 6;
      },
      deleteIndices: function () {
        return 7;
      },
      searchBulk: function (ops) {
        return ops;
      }
    };
    lib.setSearchEngine(fakeEngine);
  });

  after(function () {
    lib.setSearchEngine();
  });

  it('get', function () {
    //Check that we delegate to the right engine function
    expect(lib.get('index', 'type', 'foo')).to.equal(1);
  });

  it('can put', function () {
    expect(lib.put('index', 'type', 'foo', {})).to.equal(2);
  });
  describe('putByUri', function () {
    var fn = lib[this.title];

    it('can put by uri', function () {
      expect(fn('localhost.example.com/components/valid/instances/valid@cidklo3i80023xxkc6z0x1wnt'), {foo: 'bar'}).to.be.equal(2);
    });

    it('cannot put by uri when invalid uri', function () {
      expect(fn('localhost.example.com/valid/valid@cidklo3i80023xxkc6z0x1wnt'), {foo: 'bar'}).to.be.an('undefined');
    });
  });

  it('can delete', function () {
    expect(lib.del('index', 'type', 'foo')).to.equal(3);
  });

  describe('delByUri', function () {
    var fn = lib[this.title];

    it('can delete by uri', function () {
      expect(fn('localhost.example.com/components/valid/instances/valid@cidklo3i80023xxkc6z0x1wnt')).to.be.equal(3);
    });

    it('cannot delete by uri when invalid uri', function () {
      expect(fn('localhost.example.com/valid/instances/valid@cidklo3i80023xxkc6z0x1wnt')).to.be.an('undefined');
    });
  });

  it('can search', function () {
    expect(lib.search('index', 'type', {}, {})).to.equal(4);
  });

  it('has index', function () {
    expect(lib.hasIndex('index')).to.equal(5);
  });

  it('can create index', function () {
    expect(lib.createIndex('index', {})).to.equal(6);
  });

  it('can delete index', function () {
    expect(lib.deleteIndices('*')).to.equal(7);
  });

  it('can searchBulk', function () {
    expect(lib.searchBulk([])).to.deep.equal([]);
  });

  describe('batch', function () {
    var fn = lib[this.title];
    it('batch with no component instances keys', function () {
      //neitehr a nor b are component instances keys
      expect(fn([
        {type: 'put', key: 'a', value: '{"foo":"bar2"}'},
        {key: 'b', type: 'put', value: '{"foo":"bar"}'}
      ])).to.deep.equal([]);
    });

    it('batch with 2 component instances', function () {
      expect(fn([
          {type: 'put', key: 'localhost.example.com/components/valid/instances/valid@published', value: '{"foo":"bar2"}'},
          {key: 'localhost.example.com/press/components/valid2/instances/valid', type: 'put', value: '{"foo":"bar"}'}]
          )).to.deep.equal(
            [{ command: 'put',
                doc: { foo: 'bar2' },
                id: 'localhost.example.com/components/valid/instances/valid@published',
                index: 'amphora-valid',
                type: 'published' },
              { command: 'put',
                doc: { foo: 'bar' },
                id: 'localhost.example.com/press/components/valid2/instances/valid',
                index: 'amphora-press-valid2',
                type: 'draft' }]
        );
    });
  });
});

describe('getSearchIndex', function () {
  var fn = lib[this.title];
  it('returns correct index for component', function () {
    expect(fn('localhost.example.com/components/valid/instances/valid@cidklo3i80023xxkc6z0x1wnt'))
      .deep.equal({
        index: 'amphora-valid',
        type: 'draft'
      });
  });

  it('returns correct type for published component', function () {
    expect(fn('localhost.example.com/components/valid/instances/valid@published'))
      .deep.equal({
        index: 'amphora-valid',
        type: 'published'
      });
  });

  it('returns no index for not components uri', function () {
    expect(fn('localhost.example.com/pages/valid/instances/valid@cidklo3i80023xxkc6z0x1wnt'))
    .to.not.have.property('index');
  });
});
