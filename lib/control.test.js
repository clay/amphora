'use strict';

const _ = require('lodash'),
  filename = __filename.split('/').pop().split('.').shift(),
  lib = require('./' + filename),
  expect = require('chai').expect,
  sinon = require('sinon');

describe(_.startCase(filename), function () {
  let sandbox;

  beforeEach(function () {
    sandbox = sinon.sandbox.create();
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
