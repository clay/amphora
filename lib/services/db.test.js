var db = require('./db'),
    _ = require('lodash'),
    expect = require('chai').expect;

describe('Generic db switcher test', function () {

    beforeEach(function () {
        db.setStorageEngine(null);
    });

    afterEach(function () {
        db.setStorageEngine(null);
    });

    after(function () {
        db.setStorageEngine(null);
    });

    it('contains default list of functions', function () {
        expect(_.sortBy(Object.keys(db), function(s){return s;})).to.deep.equal([
            'batch',
            'clear',
            'del',
            'formatBatchOperations',
            'get',
            'list',
            'put',
            'setStorageEngine' ]);
    });

    it('switch to a new engine with incomplete api should throw error', function () {
        var fakeEngine = {
            get: function (key) {
                return 3;
            }
        };
        expect(fakeEngine.get('')).to.equal(3);
        expect(function() {
            db.setStorageEngine(fakeEngine);
        }).to.throw();
    });
});

describe('Fake DB', function () {

    before(function () {
      var fakeEngine = {
          get: function (key) {
              return 1;
          },
          put: function (key, value) {
              return 2;
          },
          del: function (key) {
              return 3;
          },
          list: function (ops) {
              return 4;
          },
          clear: function () {
              return 5;
          },
          batch: function (ops) {
              return 6;
          }
      };
      db.setStorageEngine(fakeEngine);;
    });

    after(function () {
        db.setStorageEngine(null);
    });

    it('get a key', function () {
        expect(db.get('foo')).to.equal(1);
    });

    it('put a key/val', function () {
        expect(db.put('key', 'val')).to.equal(2);
    });

    it('del a key', function () {
        expect(db.del('key')).to.equal(3);
    });

    it('list', function () {
      expect(db.list({})).to.equal(4);
    });

    it('clear db', function () {
      expect(db.clear()).to.equal(5);
    });

    it('batch', function () {
      expect(db.batch({})).to.equal(6);
      });
});

describe('formatBatchOperations', function () {
  var fn = db[this.title];

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
      var obj = {};
      _.times(100, function (index) { obj[index] = index; });

      fn([{type: 'put', key: 'a', value: JSON.stringify(obj)}]);
    }).to.not.throw();
  });
});
