'use strict';

var _ = require('lodash'),
  filename = __filename.split('/').pop().split('.').shift(),
  lib = require('./' + filename),
  expect = require('chai').expect,
  sinon = require('sinon');

describe(_.startCase(filename), function () {
  var sandbox;

  beforeEach(function () {
    sandbox = sinon.sandbox.create();
  });

  afterEach(function () {
    sandbox.restore();
  });

  describe('replaceVersion', function () {
    var fn = lib[this.title];

    it('replaces version with new version', function () {
      expect(fn('a@b', 'c')).to.equal('a@c');
    });

    it('replaces version with no version', function () {
      expect(fn('a@b')).to.equal('a');
    });

    it('replaces no version with version', function () {
      expect(fn('a', 'c')).to.equal('a@c');
    });
  });

  describe('replaceAllVersions', function () {
    var fn = lib[this.title];

    it('replaces all versions with new version', function () {
      expect(fn('c')({_ref: 'x@x', deep: {_ref: 'a@b', thing: {_ref: 'a'}}})).to.deep.equal({_ref: 'x@x', deep: {_ref: 'a@c', thing: {_ref: 'a@c'}}});
    });

    it('replaces all versions with no version', function () {
      expect(fn()({_ref: 'x@x', deep: {_ref: 'a@b', thing: {_ref: 'a'}}})).to.deep.equal({_ref: 'x@x', deep: {_ref: 'a', thing: {_ref: 'a'}}});
    });
  });

  describe('setPropagatingVersions', function () {
    var fn = lib[this.title],
      originalValue;

    before(function () {
      originalValue = lib.getPropagatingVersions();
    });

    after(function () {
      lib.setPropagatingVersions(originalValue);
    });

    it('sets', function () {
      expect(function () { fn([]); }).to.not.throw();
    });
  });
});
