var db = require('./db'),
    _ = require('lodash'),
    expect = require('chai').expect;

describe('Generic db switcher test', function () {

    beforeEach(function () {
        db.switchStorageEngine();
    });

    afterEach(function () {
        db.switchStorageEngine();
    });

    after(function () {
        db.switchStorageEngine();
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
            'switchStorageEngine' ]);
    });

    it('switch to a new engine with incomplete api should throw error', function () {
        var fakeEngine = {
            get: function (key) {
                return 3;
            }
        };
        expect(fakeEngine.get('')).to.equal(3);
        expect(function() {
            db.switchStorageEngine(fakeEngine);
        }).to.throw();
    });

    it('switch to a new engine with full api', function () {
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
            },
            formatBatchOperations: function (ops) {
                return 7;
            }
        };
        db.switchStorageEngine(fakeEngine);
        //Check that we delegate to the right engine function
        expect(db.get('foo')).to.equal(1);
        expect(db.put('key', 'val')).to.equal(2);
        expect(db.del('key')).to.equal(3);
        expect(db.list({})).to.equal(4);
        expect(db.clear()).to.equal(5);
        expect(db.batch({})).to.equal(6);
        expect(db.formatBatchOperations({})).to.equal(7);
    });
});

