'use strict';
const _ = require('lodash'),
  db = require('./db'),
  filename = __filename.split('/').pop().split('.').shift(),
  expect = require('chai').expect,
  sinon = require('sinon'),
  lib = require('./' + filename),
  buf = require('./buffer');

describe(_.startCase(filename), function () {
  let sandbox;

  beforeEach(function () {
    sandbox = sinon.sandbox.create();
    sandbox.stub(db, 'put');
  });

  afterEach(function () {
    sandbox.restore();
  });

  describe('encode', function () {
    const fn = lib[this.title];

    it('encodes username and provider', function () {
      expect(fn('foo', 'bar')).to.equal(buf.encode('foo@bar'));
    });
  });

  describe('decode', function () {
    const fn = lib[this.title];

    it('decodes username and provider', function () {
      var encoded = buf.encode('foo@bar');

      expect(fn(encoded)).to.equal('foo@bar');
    });
  });
});
