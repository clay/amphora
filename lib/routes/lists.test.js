'use strict';

const _ = require('lodash'),
  filename = __filename.split('/').pop().split('.').shift(),
  lib = require('./' + filename),
  responses = require('../responses'),
  sinon = require('sinon'),
  expect = require('chai').expect,
  winston = require('winston');

describe(_.startCase(filename), function () {
  let sandbox;

  /**
   * Shortcut
   */
  function expectNoLogging() {
    sinon.assert.notCalled(winston.log);
    sinon.assert.notCalled(winston.info);
    sinon.assert.notCalled(winston.warn);
    sinon.assert.notCalled(winston.error);
  }

  beforeEach(function () {
    sandbox = sinon.sandbox.create();
    sandbox.stub(winston);
  });

  afterEach(function () {
    sandbox.restore();
  });

  describe('onlyJSONLists', function () {
    const fn = lib[this.title];

    it('allows undefined body', function () {
      const next = sandbox.spy(),
        req = {},
        res = {};

      sandbox.stub(responses, 'clientError');

      fn(req, res, next);

      expect(next.called).to.equal(true);
      expect(responses.clientError.called).to.equal(false);
      expectNoLogging();
    });

    it('allows array body', function () {
      const next = sandbox.spy(),
        req = {},
        res = {};

      req.body = [];
      sandbox.stub(responses, 'clientError');

      fn(req, res, next);

      expect(next.called).to.equal(true);
      expect(responses.clientError.called).to.equal(false);
      expectNoLogging();
    });

    it('error when req.body is object', function () {
      const next = sandbox.spy(),
        req = {},
        res = {};

      req.body = {};
      sandbox.stub(responses, 'clientError');

      fn(req, res, next);

      expect(next.called).to.equal(false);
      expect(responses.clientError.callCount).to.equal(1);
      expectNoLogging();
    });
  });
});