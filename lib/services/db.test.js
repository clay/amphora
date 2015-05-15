'use strict';

var _ = require('lodash'),
  filename = __filename.split('/').pop().split('.').shift(),
  lib = require('./' + filename),
  bluebird = require('bluebird'),
  expect = require('chai').expect,
  sinon = require('sinon'),
  NotFoundError = require('levelup').NotFoundError;

describe(_.startCase(filename), function () {
  var sandbox;

  beforeEach(function () {
    sandbox = sinon.sandbox.create();
    return lib.clear();
  });

  afterEach(function () {
    sandbox.restore();
  });

  after(function () {
    return lib.clear();
  });

  it('can put and get strings', function (done) {
    lib.put('1', '2').then(function () {
      return lib.get('1');
    }).done(function (result) {
      expect(result).to.equal('2');
      done();
    }, function (err) {
      done(err);
    });
  });

  it('can put and del strings', function (done) {
    lib.put('1', '2').then(function () {
      return lib.del('1');
    }).done(function (result) {
      expect(result).to.equal(undefined);
      done();
    }, function (err) {
      done(err);
    });
  });

  it('cannot get deleted strings', function (done) {
    lib.put('1', '2').then(function () {
      return lib.del('1');
    }).then(function () {
      return lib.get('1');
    }).done(function (result) {
      done(result); //should not happen
    }, function (err) {
      expect(err.name).to.equal('NotFoundError');
      done();
    });
  });

  describe('clear', function () {
    var fn = lib[this.title];

    it('handles db errors as promise', function (done) {
      var on, mockOn;

      //fake pipe;
      on = function () { return on; };
      on.on = on;
      sandbox.stub(lib.getDB(), 'createReadStream', _.constant(on));
      mockOn = sandbox.mock(on);
      mockOn.expects('on').withArgs('data', sinon.match.func).yields('some data').exactly(1).returns(on);
      mockOn.expects('on').withArgs('error', sinon.match.func).yields('whatever').exactly(1).returns(on);
      mockOn.expects('on').withArgs('end', sinon.match.func).yields().exactly(1).returns(on);

      fn().done(function (result) {
        done(result); //should not happen
      }, function () {
        sandbox.verify();
        done();
      });
    });

    it('deletes all records', function (done) {
      lib.put('1', '2').then(function () {
        return fn();
      }).then(function () {
        return bluebird.settle([lib.get('1'), lib.get('2')]);
      }).spread(function (get1, get2) {

        expect(get1.isRejected()).to.equal(true);
        expect(get2.isRejected()).to.equal(true);

      }).done(function () {
        done();
      }, function (err) {
        done(err);
      });
    });
  });

  describe('list', function () {
    var fn = lib[this.title];

    it('default behaviour', function (done) {
      var str = '';
      bluebird.join(lib.put('1', '2'), lib.put('3', '4'), lib.put('5', '6'))
        .then(function () {
          fn().on('data', function (data) {
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
      bluebird.join(lib.put('1', '2'), lib.put('3', '4'), lib.put('5', '6'))
        .then(function () {
          fn({keys: true, values: false}).on('data', function (data) {
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
      bluebird.join(lib.put('1', '2'), lib.put('3', '4'), lib.put('5', '6'))
        .then(function () {
          fn({keys: false, values: true}).on('data', function (data) {
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
      bluebird.join(lib.put('1', '2'), lib.put('3', '4'), lib.put('5', '6'))
        .then(function () {
          fn({isArray: true}).on('data', function (data) {
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
      fn({isArray: true}).on('data', function (data) {
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
      fn({isArray: false}).on('data', function (data) {
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