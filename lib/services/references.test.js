'use strict';

const _ = require('lodash'),
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
    const fn = lib[this.title];

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
    const fn = lib[this.title];

    it('replaces all versions with new version', function () {
      expect(fn('c')({_ref: 'x@x', deep: {_ref: 'a@b', thing: {_ref: 'a'}}})).to.deep.equal({_ref: 'x@x', deep: {_ref: 'a@c', thing: {_ref: 'a@c'}}});
    });

    it('replaces all versions with no version', function () {
      expect(fn()({_ref: 'x@x', deep: {_ref: 'a@b', thing: {_ref: 'a'}}})).to.deep.equal({_ref: 'x@x', deep: {_ref: 'a', thing: {_ref: 'a'}}});
    });
  });

  describe('setPropagatingVersions', function () {
    const fn = lib[this.title];
    var originalValue;

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

  describe('isUrl', function () {
    const fn = lib[this.title];

    it('is false when given undefined', function () {
      expect(fn()).to.equal(false);
    });

    it('knows a url without path', function () {
      expect(fn('http://something.com')).to.equal(true);
    });

    it('knows a url with empty', function () {
      expect(fn('http://something.com/')).to.equal(true);
    });

    it('knows a url with port', function () {
      expect(fn('http://something.com:3333/')).to.equal(true);
    });

    it('fails without protocol', function () {
      expect(fn('something.com:3333')).to.equal(false);
    });
  });

  describe('isUri', function () {
    const fn = lib[this.title];

    it('is false when given undefined', function () {
      expect(fn()).to.equal(false);
    });

    it('knows not a uri with protocol', function () {
      expect(fn('http://something.com')).to.equal(false);
    });

    it('knows not a uri with port', function () {
      expect(fn('something.com:3333')).to.equal(false);
    });

    it('knows not a uri with protocol and path', function () {
      expect(fn('http://something.com/something')).to.equal(false);
    });

    it('knows not a uri without protocol with path', function () {
      expect(fn('something.com:3333/something')).to.equal(false);
    });

    it('knows a uri with path', function () {
      expect(fn('something.com/something')).to.equal(true);
    });

    it('knows a uri without path', function () {
      expect(fn('something.com')).to.equal(true);
    });
  });
});
