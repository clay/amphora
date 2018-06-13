'use strict';

const _ = require('lodash'),
  filename = __filename.split('/').pop().split('.').shift(),
  lib = require('./' + filename),
  sinon = require('sinon'),
  expect = require('chai').expect,
  redis = require('redis');

describe(_.startCase(filename), function () {
  var sandbox, publish;

  beforeEach(function () {
    sandbox = sinon.sandbox.create();
    sandbox.stub(redis);
    publish = sandbox.stub();
    lib.client = { publish };
  });

  afterEach(function () {
    sandbox.restore();
  });

  describe('connect', function () {
    const fn = lib[this.title];

    it('calls the `createClient` method for Redis', function () {
      fn();
      sinon.assert.calledOnce(redis.createClient);
    });
  });

  describe('publish', function () {
    const fn = lib[this.title];

    it('throws an error if topic and message are not defined', function () {
      expect(fn).to.throw();
    });

    it('throws an error if topic is not a string', function () {
      expect(() => fn(1, 'foo')).to.throw();
    });

    it('throws an error if message is not defined', function () {
      expect(() => fn('foo', 1)).to.throw();
    });

    it('calls the publish function if topic and string pass validation', function () {
      fn('foo', 'bar');
      sinon.assert.calledOnce(publish);
    });

    it('does not call publish if no client is defined', function () {
      lib.client = false;
      fn('foo', 'bar');
      sinon.assert.notCalled(publish);
    });
  });
});
