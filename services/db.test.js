var db = require('./db'),
  expect = require('chai').expect,
  NotFoundError = require('levelup').NotFoundError;

describe('db', function () {
  it('can put and get strings', function (done) {
    db.put('1', '2').then(function () {
      return db.get('1');
    }).then(function (result) {
      expect(result).to.equal('2');
      done();
    }, function (err) {
      done(err);
    });
  });

  it('can put and del strings', function (done) {
    db.put('1', '2').then(function () {
      return db.del('1');
    }).then(function (result) {
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
    }).then(function (result) {
      done(result); //should not happen
    }, function (err) {
      expect(err.name).to.equal('NotFoundError');
      done();
    }).catch(function (err) {
      done(err);
    });
  });
});