'use strict';

var _ = require('lodash'),
  filename = __filename.split('/').pop().split('.').shift(),
  lib = require('./' + filename),
  responses = require('../responses'),
  sinon = require('sinon'),
  expect = require('chai').expect,
  log = require('../log');

describe(_.startCase(filename), function () {
  var sandbox;

  /**
   * Shortcut
   */
  function expectNoLogging() {
    var logExpectations = sandbox.mock(log);
    logExpectations.expects('info').never();
    logExpectations.expects('warn').never();
    logExpectations.expects('error').never();
  }

  beforeEach(function () {
    sandbox = sinon.sandbox.create();
  });

  afterEach(function () {
    sandbox.restore();
  });

  describe('onlyJSONLists', function () {
    var fn = lib[this.title];

    it('allows undefined body', function () {
      var next = sandbox.spy(),
        req = {},
        res = {};

      expectNoLogging();
      sandbox.stub(responses, 'clientError');

      fn(req, res, next);

      expect(next.called).to.equal(true);
      expect(responses.clientError.called).to.equal(false);
    });

    it('allows array body', function () {
      var next = sandbox.spy(),
        req = {},
        res = {};

      expectNoLogging();
      req.body = [];
      sandbox.stub(responses, 'clientError');

      fn(req, res, next);

      expect(next.called).to.equal(true);
      expect(responses.clientError.called).to.equal(false);
    });

    it('error when req.body is object', function () {
      var next = sandbox.spy(),
        req = {},
        res = {};

      expectNoLogging();
      req.body = {};
      sandbox.stub(responses, 'clientError');

      fn(req, res, next);

      expect(next.called).to.equal(false);
      expect(responses.clientError.callCount).to.equal(1);
    });
  });
});