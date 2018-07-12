'use strict';
const _ = require('lodash'),
  filename = __filename.split('/').pop().split('.').shift(),
  expect = require('chai').expect,
  sinon = require('sinon'),
  lib = require('./' + filename),
  storage = require('../../test/fixtures/mocks/storage'),
  buf = require('./buffer');

describe(_.startCase(filename), function () {
  let sandbox, db;

  beforeEach(function () {
    sandbox = sinon.sandbox.create();
    db = storage();
    lib.setDb(db);
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
