'use strict';

const _ = require('lodash'),
  filename = __filename.split('/').pop().split('.').shift(),
  lib = require('./' + filename),
  log = require('./log'),
  expect = require('chai').expect,
  sinon = require('sinon');

describe(_.startCase(filename), function () {
  var sandbox;

  beforeEach(function () {
    sandbox = sinon.sandbox.create();
    sandbox.stub(log);
  });

  afterEach(function () {
    sandbox.restore();
  });

  describe('setReadOnly', function () {
    const fn = lib[this.title];

    it('takes null', function () {
      var data = null;

      expect(fn(data)).to.equal(data);
    });

    it('takes empty object', function () {
      var data = {};

      expect(fn(data)).to.equal(data);
    });
  });

  describe('memoize', function () {
    var memLeak;
    const fn = lib[this.title];

    beforeEach(function () {
      memLeak = lib.getMemoryLeakThreshold();
    });

    afterEach(function () {
      lib.setMemoryLeakThreshold(memLeak);
    });

    it('memoizes', function () {
      var resultFn, target = function () { return 'd'; };

      resultFn = fn(target);

      resultFn('a', 'b', 'c');

      expect(resultFn.cache.__data__).to.deep.equal({a: 'd'});
    });

    it('warns when over the limit', function () {
      var resultFn, target = function namedFn() { return 'd'; };

      lib.setMemoryLeakThreshold(2);

      resultFn = fn(target);

      resultFn('a');
      resultFn('b');
      resultFn('c');

      sinon.assert.calledWith(log.warn, 'Memory leak', 'namedFn', { a: 'd', b: 'd', c: 'd' });
    });
  });

  describe('defineReadOnly', function () {
    const fn = lib[this.title];

    it('defines a property that is read-only', function () {
      expect(fn({})).to.deep.equal({ writable: false, enumerable: false, configurable: false});
    });

    it('defines a property that is read-only with a getter', function () {
      const getter = _.noop;

      expect(fn({get: getter})).to.deep.equal({ enumerable: false, configurable: false, get: getter});
    });

    it('defines a property that is read-only with a getter and setter, but only the getter works', function () {
      const getter = _.noop,
        setter = _.noop;

      expect(fn({get: getter, set: setter})).to.deep.equal({ enumerable: false, configurable: false, get: getter});
    });
  });

  describe('defineWritable', function () {
    const fn = lib[this.title];

    it('defines a property that is writable', function () {
      expect(fn({})).to.deep.equal({writable: true, enumerable: false, configurable: false});
    });

    it('defines a property that is writable with a getter', function () {
      const getter = _.noop;

      expect(fn({get: getter})).to.deep.equal({enumerable: false, configurable: false, get: getter});
    });

    it('defines a property that is writable with a getter and setter', function () {
      const getter = _.noop,
        setter = _.noop;

      expect(fn({get: getter, set: setter})).to.deep.equal({enumerable: false, configurable: false, get: getter, set: setter});
    });
  });
});