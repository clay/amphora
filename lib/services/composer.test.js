'use strict';

const _ = require('lodash'),
  bluebird = require('bluebird'),
  components = require('./components'),
  expect = require('chai').expect,
  filename = __filename.split('/').pop().split('.').shift(),
  lib = require('./' + filename),
  sinon = require('sinon');

describe(_.startCase(filename), function () {
  let sandbox, logSpy;

  beforeEach(function () {
    sandbox = sinon.sandbox.create();
    logSpy = sandbox.spy();

    sandbox.stub(components, 'get');
    lib.setLog(logSpy);
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

      // use done() rather than returning the promise, so we can catch and test errors
      fn(data).then(done).catch((error) => {
        sinon.assert.calledOnce(logSpy);
        expect(error.message).to.equal('hello!');
        done();
      });
    });

    it('adds the status to the error message if it one is defined', function (done) {
      const data = {
          a: {_ref: '/c/b'},
          c: {d: {_ref: '/c/e'}}
        },
        myError = new Error('hello!');

      myError.status = 404;
      components.get.withArgs('/c/b').returns(bluebird.resolve({g: 'h'}));
      components.get.withArgs('/c/e').returns(bluebird.resolve({i: 'j', k: {_ref: '/c/m'}}));
      components.get.withArgs('/c/m').returns(bluebird.reject(myError));

      // use done() rather than returning the promise, so we can catch and test errors
      fn(data).then(done).catch((error) => {
        sinon.assert.calledOnce(logSpy);
        expect(error.message).to.equal('hello!');
        sinon.assert.calledWith(logSpy, 'error', 'hello!', { status: myError.status, cmpt: '/c/e', stack: myError.stack });
        done();
      });
    });
  });

  describe('composePage', function () {
    const fn = lib[this.title];

    beforeEach(function () {
      components.get.withArgs('/some/layout').returns(bluebird.resolve({
        head: 'head',
        top: [{
          _ref: '/e/f'
        }]
      }));

      components.get.withArgs('/a/b').returns(bluebird.resolve({
        _ref: '/a/b',
        c: 'd'
      }));

      components.get.withArgs('/e/f').returns(bluebird.resolve({
        _ref: '/e/f',
        g: 'h'
      }));

    });

    it('composes pages', function (done) {
      const pageData = {
        head: [
          '/a/b'
        ],
        layout: '/some/layout'
      };

      fn(pageData)
        .then((result) => {
          expect(result).to.deep.equal({
            head: [{
              _ref: '/a/b',
              c: 'd'
            }],
            top: [{
              _ref: '/e/f',
              g: 'h'
            }]
          });
        })
        .then(done)
        .catch(done);
    });

    it('throws errors if page data is not defined', function () {
      expect(()=>fnc()).to.throw(Error);
    });
  });

  describe('filterBaseInstanceReferences', function () {
    const fn = lib[this.title];

    it('finds a component reference', function () {
      expect(fn({ _ref: 'domain.com/_components/foo/instances/bar' })).to.be.true;
    });

    it('ignores a regular component data', function () {
      expect(fn({ bar: 'foo' })).to.be.false;
    });
  });
});
