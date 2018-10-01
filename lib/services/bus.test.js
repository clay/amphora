'use strict';

const _ = require('lodash'),
  filename = __filename.split('/').pop().split('.').shift(),
  lib = require('./' + filename),
  sinon = require('sinon'),
  expect = require('chai').expect,
  Redis = require('ioredis');

describe(_.startCase(filename), function () {
  var sandbox, publish, fakeLog;

  beforeEach(function () {
    sandbox = sinon.sandbox.create();
    sandbox.stub(Redis.prototype, 'connect');
    publish = sandbox.stub();
    fakeLog = sandbox.stub();
    lib.client = { publish };
    lib.setLog(fakeLog);
  });

  afterEach(function () {
    sandbox.restore();
  });

  describe('connect', function () {
    const fn = lib[this.title];

    it('calls the internal `connect` method for the ioredis Redis Client', function () {
      Redis.prototype.connect.resolves(true);
      fn();
      sinon.assert.calledOnce(Redis.prototype.connect);
    });
  });

  describe('publish', function () {
    const fn = lib[this.title],
      testObj = { foo: 'bar' };

    it('throws an error if topic and message are not defined', function () {
      expect(fn).to.throw();
    });

    it('throws an error if topic is not a string', function () {
      expect(() => fn(1, 'foo')).to.throw();
    });

    it('throws an error if message is not defined', function () {
      expect(() => fn('foo', 1)).to.throw();
    });

    it('calls the publish function if topic and message pass validation', function () {
      fn('foo', testObj);
      sinon.assert.calledOnce(publish);
    });

    it('does not call publish if no client is defined', function () {
      lib.client = false;
      fn('foo', testObj);
      sinon.assert.notCalled(publish);
    });

    it('accepts a bus module passed into the connect method', function () {
      const fakePub = sandbox.spy(),
        fakeBus = { connect: () => ({ publish: fakePub })};

      lib.connect(fakeBus);
      fn('foo', testObj);
      sinon.assert.calledOnce(fakePub);
    });
  });
});
