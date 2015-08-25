var search = require('./search'),
  _ = require('lodash'),
  expect = require('chai').expect;

describe('Generic search switcher test', function () {

  beforeEach(function () {
    search.setSearchEngine();
  });

  afterEach(function () {
    search.setSearchEngine();
  });

  it('contains default list of functions', function () {
    expect(_.sortBy(Object.keys(search), function(s){return s;})).to.deep.equal([
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
      'setSearchEngine' ]);
  });

  it('switch to a new engine with incomplete api should throw error', function () {
    var fakeEngine = {
      get: function (key) {
        return 3;
      }
    };
    expect(fakeEngine.get('')).to.equal(3);
    expect(function() {
      search.setSearchEngine(fakeEngine);
    }).to.throw();
  });

});

describe('Switch to a complete mock search engine', function () {

  before(function () {
    const fakeEngine = {
      get: function (index, type, id) {
        return 1;
      },
      put: function (index, type, id, doc) {
        return 2;
      },
      del: function (index, type, id) {
        return 3;
      },
      search: function (indices, types, query, ops) {
        return 4;
      },
      hasIndex: function (index) {
        return 5;
      },
      createIndex: function (index, body) {
        return 6;
      },
      deleteIndices: function (indices) {
        return 7;
      },
      searchBulk: function (ops) {
        return ops;
      }
    };
    search.setSearchEngine(fakeEngine);
  });

  after(function () {
    search.setSearchEngine();
  });

  it('can get', function () {
    //Check that we delegate to the right engine function
    expect(search.get('index', 'type', 'foo')).to.equal(1);
  });

  it('can put', function () {
    expect(search.put('index', 'type', 'foo', {})).to.equal(2);
  });

  it('can put by uri', function () {
    expect(search.putByUri('localhost.example.com/components/valid/instances/valid@cidklo3i80023xxkc6z0x1wnt'), {foo: 'bar'}).to.be.equal(2);
  });

  it('cannot put by uri when invalid uri', function () {
    expect(search.putByUri('localhost.example.com/valid/valid@cidklo3i80023xxkc6z0x1wnt'), {foo: 'bar'}).to.be.undefined;
  });

  it('can delete', function () {
    expect(search.del('index', 'type', 'foo')).to.equal(3);
  });

  it('can delete by uri', function () {
    expect(search.delByUri('localhost.example.com/components/valid/instances/valid@cidklo3i80023xxkc6z0x1wnt')).to.be.equal(3);
  });

  it('cannot delete by uri when invalid uri', function () {
    expect(search.delByUri('localhost.example.com/valid/instances/valid@cidklo3i80023xxkc6z0x1wnt')).to.be.undefined;
  });

  it('can search', function () {
    expect(search.search('index', 'type', {}, {})).to.equal(4);
  });

  it('has index', function () {
      expect(search.hasIndex('index')).to.equal(5);
  });

  it('can create index', function () {
      expect(search.createIndex('index', {})).to.equal(6);
  });

  it('can delete index', function () {
      expect(search.deleteIndices('*')).to.equal(7);
  });

  it('can searchBulk', function () {
    expect(search.searchBulk([])).to.deep.equal([]);
  });

  it('batch with no component instances keys', function () {
    //neitehr a nor b are component instances keys
    expect(search.batch([
      {type: 'put', key: 'a', value: '{"foo":"bar2"}'},
      {key: 'b', type: 'put', value: '{"foo":"bar"}'}
    ])).to.deep.equal([])
  });

  it('batch with 2 component instances', function () {
    expect(search.batch([
        {type: 'put', key: 'localhost.example.com/components/valid/instances/valid@published', value: '{"foo":"bar2"}'},
        {key: 'localhost.example.com/press/components/valid2/instances/valid', type: 'put', value: '{"foo":"bar"}'}]
        )).to.deep.equal(
          [ { command: 'put',
              doc: { foo: 'bar2' },
              id: 'localhost.example.com/components/valid/instances/valid@published',
              index: 'amphora-valid',
              type: 'published' },
            { command: 'put',
              doc: { foo: 'bar' },
              id: 'localhost.example.com/press/components/valid2/instances/valid',
              index: 'amphora-press-valid2',
              type: 'draft' } ]
      );
    });
});

describe('Uri parsing to search index', function () {

  it('returns correct index for component', function () {
    expect(search.getSearchIndex('localhost.example.com/components/valid/instances/valid@cidklo3i80023xxkc6z0x1wnt'))
      .deep.equal({
        index: 'amphora-valid',
        type: 'draft'
      });
  });

  it('returns correct type for published component', function () {
    expect(search.getSearchIndex('localhost.example.com/components/valid/instances/valid@published'))
      .deep.equal({
        index: 'amphora-valid',
        type: 'published'
      });
  });

  it('returns no index for not components uri', function () {
    expect(search.getSearchIndex('localhost.example.com/pages/valid/instances/valid@cidklo3i80023xxkc6z0x1wnt'))
    .to.not.have.property('index');
  });
});
