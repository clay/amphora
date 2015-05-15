'use strict';

var db = require('./db'),
  bluebird = require('bluebird'),
  expect = require('chai').expect,
  NotFoundError = require('levelup').NotFoundError;

describe('db', function () {

  beforeEach(function () {
    return db.clear();
  });

  after(function () {
    return db.clear();
  });

  it('can put and get strings', function (done) {
    db.put('1', '2').then(function () {
      return db.get('1');
    }).done(function (result) {
      expect(result).to.equal('2');
      done();
    }, function (err) {
      done(err);
    });
  });

  it('can put and del strings', function (done) {
    db.put('1', '2').then(function () {
      return db.del('1');
    }).done(function (result) {
      expect(result).to.equal(undefined);
      done();
    }, function (err) {
      done(err);
    });
  });

  it('cannot get deleted strings', function (done) {
    db.put('1', '2').then(function () {
      return db.del('1');
    }).then(function () {
      return db.get('1');
    }).done(function (result) {
      done(result); //should not happen
    }, function (err) {
      expect(err.name).to.equal('NotFoundError');
      done();
    });
  });


  it('clear deletes all records', function (done) {
    db.put('1', '2').then(function () {
      return db.clear();
    }).then(function () {
      return bluebird.settle([db.get('1'), db.get('2')]);
    }).spread(function (get1, get2) {

      expect(get1.isRejected()).to.equal(true);
      expect(get2.isRejected()).to.equal(true);

    }).done(function () {
      done();
    }, function (err) {
      done(err);
    });
  });

  describe('list', function () {
    it('default', function (done) {
      var str = '';
      bluebird.join(db.put('1', '2'), db.put('3', '4'), db.put('5', '6'))
        .then(function () {
          db.list().on('data', function (data) {
            str += data;
          }).on('error', function (err) {
            done(err);
          }).on('end', function () {
            expect(str).to.equal('{"1":"2","3":"4","5":"6"}');
            done();
          });
        });
    });

    it('can get keys-only in array structure', function (done) {
      var str = '';
      bluebird.join(db.put('1', '2'), db.put('3', '4'), db.put('5', '6'))
        .then(function () {
          db.list({keys: true, values: false}).on('data', function (data) {
            str += data;
          }).on('error', function (err) {
            done(err);
          }).on('end', function () {
            expect(str).to.equal('["1","3","5"]');
            done();
          });
        });
    });

    it('can get values-only in array structure', function (done) {
      var str = '';
      bluebird.join(db.put('1', '2'), db.put('3', '4'), db.put('5', '6'))
        .then(function () {
          db.list({keys: false, values: true}).on('data', function (data) {
            str += data;
          }).on('error', function (err) {
            done(err);
          }).on('end', function () {
            expect(str).to.equal('["2","4","6"]');
            done();
          });
        });
    });

    it('can get key-value in object structure in array', function (done) {
      var str = '';
      bluebird.join(db.put('1', '2'), db.put('3', '4'), db.put('5', '6'))
        .then(function () {
          db.list({isArray: true}).on('data', function (data) {
            str += data;
          }).on('error', function (err) {
            done(err);
          }).on('end', function () {
            expect(str).to.equal('[{"key":"1","value":"2"},{"key":"3","value":"4"},{"key":"5","value":"6"}]');
            done();
          });
        });
    });

    it('can return empty data safely for arrays', function (done) {
      var str = '';
      db.list({isArray: true}).on('data', function (data) {
        str += data;
      }).on('error', function (err) {
        done(err);
      }).on('end', function () {
        expect(str).to.equal('[]');
        done();
      });
    });

    it('can return empty data safely for objects', function (done) {
      var str = '';
      db.list({isArray: false}).on('data', function (data) {
        str += data;
      }).on('error', function (err) {
        done(err);
      }).on('end', function () {
        expect(str).to.equal('{}');
        done();
      });
    });
  });
});