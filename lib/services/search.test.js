var search = require('./search'),
  _ = require('lodash'),
  expect = require('chai').expect;

describe('Generic search switcher test', function () {

  beforeEach(function () {
    search.switchSearchEngine();
  });

  afterEach(function () {
    search.switchSearchEngine();
  });

  it('contains default list of functions', function () {
    expect(_.sortBy(Object.keys(search), function(s){return s;})).to.deep.equal([
       'applyDelOrPut',
      'batch',
      'batchDBFormat',
      'createIndex',
      'delete',
      'deleteIndices',
      'get',
      'getSearchIndex',
      'hasIndex',
      'put',
      'search',
      'switchSearchEngine' ]);
  });

  it('switch to a new engine with incomplete api should throw error', function () {
    var fakeEngine = {
      get: function (key) {
        return 3;
      }
    };
    expect(fakeEngine.get('')).to.equal(3);
    expect(function() {
      search.switchSearchEngine(fakeEngine);
    }).to.throw();
  });

  it('switch to a new engine with full api', function () {
    var fakeEngine = {
      get: function (index, type, id) {
        return 1;
      },
      put: function (index, type, id, doc) {
        return 2;
      },
      delete: function (index, type, id) {
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
      batch: function (ops) {
        return ops;
      }
    };
    search.switchSearchEngine(fakeEngine);
    //Check that we delegate to the right engine function
    expect(search.get('index', 'type', 'foo')).to.equal(1);
    expect(search.put('index', 'type', 'foo', {})).to.equal(2);
    expect(search.delete('index', 'type', 'foo')).to.equal(3);
    expect(search.search('index', 'type', {}, {})).to.equal(4);
    expect(search.hasIndex('index')).to.equal(5);
    expect(search.createIndex('index', {})).to.equal(6);
    expect(search.deleteIndices(['index'])).to.equal(7);
    expect(search.batch([])).to.deep.equal([]);
    //batchDBFormat calls batch eventually
    expect(search.batchDBFormat([
      {index:'index1', indexType:'type1', type: 'put', key: 'a', value: 'str'},
      {index:'index2', indexType:'type2', key: 'b', type: 'put', value: '{"foo":"bar"}'}
    ])).to.deep.equal([ { index: 'index1',
      type: 'type1',
      doc: { value: 'str' },
      id: 'a',
      command: 'put' },
    { index: 'index2',
      type: 'type2',
      doc: { foo: 'bar' },
      id: 'b',
      command: 'put' } ]);
  });

  it('returns correct index for component', function () {
    expect(search.getSearchIndex('localhost.example.com/components/valid/instances/valid@cidklo3i80023xxkc6z0x1wnt'))
      .deep.equal({
        index: 'valid',
        type: 'draft'
      });
  });

  it('returns correct type for published component', function () {
    expect(search.getSearchIndex('localhost.example.com/components/valid/instances/valid@published'))
      .deep.equal({
        index: 'valid',
        type: 'published'
      });
  });

  it('returns no index for not components uri', function () {
    expect(search.getSearchIndex('localhost.example.com/pages/valid/instances/valid@cidklo3i80023xxkc6z0x1wnt'))
    .to.not.have.property('index');
  });

  it('applies the function with correct uri', function () {
    expect(search.applyDelOrPut('localhost.example.com/components/valid/instances/valid@cidklo3i80023xxkc6z0x1wnt', function(index, type){
      return index;
    })).to.be.equal('valid');
  });

  it('applies the function with correct uri', function (done) {
    search.applyDelOrPut('localhost.example.com/pages/valid/instances/valid@cidklo3i80023xxkc6z0x1wnt', function(index, type){
      return bluebird.resolve(index);
    }).then(function(r){
      expect(r).to.not.be.equal('valid');
      done();
    });
  });

});

