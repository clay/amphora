'use strict';

var _ = require('lodash'),
  filename = __filename.split('/').pop().split('.').shift(),
  lib = require('./' + filename),
  responses = require('../responses'),
  sinon = require('sinon'),
  log = require('../log');



describe(_.startCase(filename), function () {
  var sandbox;

  function createMockReq() {
    return {};
  }

  function createMockRes() {
    return {};
  }

  /**
   * Fail unit test immediately with message;
   * @param {string} msg
   * @param {string} [actual]
   * @param {string} [expected]
   * @param {string} [operator]
   */
  function fail(msg, actual, expected, operator) {
    require('chai').assert.fail(actual, expected, msg, operator);
  }

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

    it('allows undefined body', function (done) {
      var req = createMockReq(),
        res = createMockRes();

      expectNoLogging();
      sandbox.mock(responses).expects('clientError').never();

      fn(req, res, function () {
        done();
      });

      sandbox.verify();
    });

    it('allows array body', function (done) {
      var req = createMockReq(),
        res = createMockRes();

      expectNoLogging();
      req.body = [];
      sandbox.mock(responses).expects('clientError').never();

      fn(req, res, function () {
        done();
      });

      sandbox.verify();
    });

    it('error when req.body is object', function () {
      var req = createMockReq(),
        res = createMockRes();

      expectNoLogging();
      req.body = {};
      sandbox.mock(responses).expects('clientError').once();

      fn(req, res, function () {
        fail('next() should not be called.');
      });

      sandbox.verify();
    });
  });
});