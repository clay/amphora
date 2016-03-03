'use strict';

var _ = require('lodash'),
  bluebird = require('bluebird'),
  components = require('./components'),
  expect = require('chai').expect,
  filename = __filename.split('/').pop().split('.').shift(),
  lib = require('./' + filename),
  sinon = require('sinon');

describe(_.startCase(filename), function () {
  var sandbox;

  beforeEach(function () {
    sandbox = sinon.sandbox.create();
    sandbox.stub(components);
  });

  afterEach(function () {
    sandbox.restore();
  });

  describe('resolveComponentReferences', function () {
    const fn = lib[this.title];

    it('looks up references', function () {
      const data = {
        a: {_ref: '/c/b'},
        c: {d: {_ref: '/c/e'}}
      };

      components.get.withArgs('/c/b').returns(bluebird.resolve({g: 'h'}));
      components.get.withArgs('/c/e').returns(bluebird.resolve({i: 'j'}));

      return fn(data).then(function (result) {
        expect(result).to.deep.equal({
          a: {_ref: '/c/b', g: 'h'},
          c: {d: {_ref: '/c/e', i: 'j'}}
        });
      });
    });

    it('looks up references recursively', function () {
      const data = {
        a: {_ref: '/c/b'},
        c: {d: {_ref: '/c/e'}}
      };

      components.get.withArgs('/c/b').returns(bluebird.resolve({g: 'h'}));
      components.get.withArgs('/c/e').returns(bluebird.resolve({i: 'j', k: {_ref: '/c/m'}}));
      components.get.withArgs('/c/m').returns(bluebird.resolve({n: 'o'}));

      return fn(data).then(function (result) {
        expect(result).to.deep.equal({
          a: {_ref: '/c/b', g: 'h'},
          c: {
            d: {
              _ref: '/c/e',
              i: 'j',
              k: {
                _ref: '/c/m',
                n: 'o' // we just recursively looked this up from another lookup
              }
            }
          }
        });
      });
    });

    it('looks up references recursively while filtering (i.e., not following certain references)', function () {
      const data = {
          a: {_ref: '/c/b'},
          c: {d: {_ref: '/c/e'}}
        },
        filter = function (obj) {
          return obj._ref && obj._ref !== '/c/e';
        };

      components.get.withArgs('/c/b').returns(bluebird.resolve({g: 'h'}));
      components.get.withArgs('/c/e').returns(bluebird.resolve({i: 'j', k: {_ref: '/c/m'}}));
      components.get.withArgs('/c/m').returns(bluebird.resolve({n: 'o'}));

      return fn(data, undefined, filter).then(function (result) {
        expect(result).to.deep.equal({
          a: {_ref: '/c/b', g: 'h'},
          c: {
            d: {
              _ref: '/c/e'
            }
          }
        });
      });
    });

    it('adds additional reference information to any errors that occur', function (done) {
      const data = {
          a: {_ref: '/c/b'},
          c: {d: {_ref: '/c/e'}}
        },
        myError = new Error('hello!');

      components.get.withArgs('/c/b').returns(bluebird.resolve({g: 'h'}));
      components.get.withArgs('/c/e').returns(bluebird.resolve({i: 'j', k: {_ref: '/c/m'}}));
      components.get.withArgs('/c/m').returns(bluebird.reject(myError));

      return fn(data).then(done).catch(function (error) {
        expect(error.message).to.equal('hello! within /c/e');
        expect(error.message).to.match(/hello! within \/c\/e/);
        done();
      });
    });
  });
});
