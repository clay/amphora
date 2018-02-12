'use strict';

const _ = require('lodash'),
  filename = __filename.split('/').pop().split('.').shift(),
  lib = require('./' + filename),
  responses = require('../responses'),
  sinon = require('sinon'),
  expect = require('chai').expect;

describe(_.startCase(filename), function () {
  let sandbox;

  beforeEach(function () {
    sandbox = sinon.sandbox.create();
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
    });
  });
});
