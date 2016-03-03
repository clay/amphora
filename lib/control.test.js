'use strict';

const _ = require('lodash'),
  filename = __filename.split('/').pop().split('.').shift(),
  lib = require('./' + filename),
  winston = require('winston'),
  expect = require('chai').expect,
  sinon = require('sinon');

describe(_.startCase(filename), function () {
  let sandbox;

  beforeEach(function () {
    sandbox = sinon.sandbox.create();
    sandbox.stub(winston);
  });

  afterEach(function () {
    sandbox.restore();
  });

  describe('setReadOnly', function () {
    const fn = lib[this.title];

    it('takes null', function () {
      expect(fn(null)).to.equal(null);
    });

    it('takes empty object', function () {
      const data = {};

      expect(fn(data)).to.equal(data);
    });
  });

  describe('memoize', function () {
    let memLeak;
    const fn = lib[this.title];

    beforeEach(function () {
      memLeak = lib.getMemoryLeakThreshold();
    });

    afterEach(function () {
      lib.setMemoryLeakThreshold(memLeak);
    });

    it('memoizes', function () {
      let resultFn, target = function () { return 'd'; };

      resultFn = fn(target);

      resultFn('a', 'b', 'c');

      expect(resultFn.cache.__data__).to.deep.equal({a: 'd'});
    });

    it('warns when over the limit', function () {
      let resultFn, target = function namedFn() { return 'd'; };

      lib.setMemoryLeakThreshold(2);

      resultFn = fn(target);

      resultFn('a');
      resultFn('b');
      resultFn('c');

      sinon.assert.calledWith(winston.log, 'warn');
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