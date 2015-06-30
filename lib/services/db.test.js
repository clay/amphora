'use strict';

var _ = require('lodash'),
  filename = __filename.split('/').pop().split('.').shift(),
  lib = require('./' + filename),
  bluebird = require('bluebird'),
  expect = require('chai').expect,
  sinon = require('sinon');

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

  it('can put and get strings', function () {
    return lib.put('1', '2').then(function () {
      return lib.get('1');
    }).done(function (result) {
      expect(result).to.equal('2');
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
    }).done(function (result) {
      done(result); // should not happen
    }, function (err) {
      expect(err.name).to.equal('NotFoundError');
      done();
    });
  });

  describe('clear', function () {
    var fn = lib[this.title];

    it('handles db errors as promise', function (done) {
      var on, mockOn;

      // fake pipe
      on = function () { return on; };
      on.on = on;
      sandbox.stub(lib.getDB(), 'createReadStream', _.constant(on));
      mockOn = sandbox.mock(on);
      mockOn.expects('on').withArgs('data', sinon.match.func).yields('some data').exactly(1).returns(on);
      mockOn.expects('on').withArgs('error', sinon.match.func).yields('whatever').exactly(1).returns(on);
      mockOn.expects('on').withArgs('end', sinon.match.func).yields().exactly(1).returns(on);

      fn().done(function (result) {
        done(result); // should not happen
      }, function () {
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
    var fn = lib[this.title];

    function pipeToPromise(pipe) {
      var str = '',
        d = bluebird.defer();

      pipe.on('data', function (data) { str += data; })
        .on('error', d.reject)
        .on('end', function () {
          d.resolve(str);
        });
      return d.promise;
    }

    it('default behaviour', function () {
      return bluebird.join(lib.put('1', '2'), lib.put('3', '4'), lib.put('5', '6'))
        .then(function () {
          return pipeToPromise(fn());
        }).then(function (str) {
          expect(str).to.equal('{"1":"2","3":"4","5":"6"}');
        });
    });

    it('can get keys-only in array structure', function () {
      return bluebird.join(lib.put('1', '2'), lib.put('3', '4'), lib.put('5', '6'))
        .then(function () {
          return pipeToPromise(fn({keys: true, values: false}));
        }).then(function (str) {
          expect(str).to.equal('["1","3","5"]');
        });
    });

    it('can get values-only in array structure', function () {
      return bluebird.join(lib.put('1', '2'), lib.put('3', '4'), lib.put('5', '6'))
        .then(function () {
          return pipeToPromise(fn({keys: false, values: true}));
        }).then(function (str) {
          expect(str).to.equal('["2","4","6"]');
        });
    });

    it('can get key-value in object structure in array', function () {
      return bluebird.join(lib.put('1', '2'), lib.put('3', '4'), lib.put('5', '6'))
        .then(function () {
          return pipeToPromise(fn({isArray: true}));
        }).then(function (str) {
          expect(str).to.equal('[{"key":"1","value":"2"},{"key":"3","value":"4"},{"key":"5","value":"6"}]');
        });
    });

    it('can return empty data safely for arrays', function () {
      return pipeToPromise(fn({isArray: true})).then(function (str) {
        expect(str).to.equal('[]');
      });
    });

    it('can return empty data safely for objects', function () {
      return pipeToPromise(fn({isArray: false})).then(function (str) {
        expect(str).to.equal('{}');
      });
    });
  });
});
