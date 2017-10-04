'use strict';

const _ = require('lodash'),
  filename = __filename.split('/').pop().split('.').shift(),
  lib = require('./' + filename),
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

  describe('encode', function () {
    const fn = lib[this.title];

    it('encodes strings to Base-64', function () {
      const expected = Buffer.from('foo@bar', 'utf8').toString('base64');

      expect(fn('foo@bar')).to.equal(expected);
    });
  });

  describe('decode', function () {
    const fn = lib[this.title];

    it('decodes Base-64 strings to UTF-8 strings', function () {
      const sixtyfourstring = lib.encode('foo@bar');

      expect(fn(sixtyfourstring)).to.equal('foo@bar');
    });
  });
});
