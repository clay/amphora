'use strict';

const _ = require('lodash'),
  filename = __filename.split('/').pop().split('.').shift(),
  lib = require('./' + filename),
  expect = require('chai').expect,
  sinon = require('sinon');

describe(_.startCase(filename), function () {
  let sandbox;

  beforeEach(function () {
    sandbox = sinon.sandbox.create();
  });

  afterEach(function () {
    sandbox.restore();
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
    let originalValue;

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

  describe('uriToUrl', function () {
    const fn = lib[this.title];

    it('converts without protocol and port', function () {
      expect(fn('localhost')).to.equal('http://localhost/');
    });

    it('converts given protocol and port', function () {
      expect(fn('localhost', 'https', '3333')).to.equal('https://localhost:3333/');
    });

    it('does not say port 80 for http', function () {
      expect(fn('localhost', 'http', '80')).to.equal('http://localhost/');
    });
  });

  describe('urlToUri', function () {
    const fn = lib[this.title];

    it('throws with invalid url', function () {
      expect(function () { fn('localhost'); }).to.throw();
    });

    it('converts without port', function () {
      expect(fn('http://localhost')).to.equal('localhost/');
    });

    it('converts with port', function () {
      expect(fn('http://localhost:3333')).to.equal('localhost/');
    });

    it('converts without port with path', function () {
      expect(fn('http://localhost/some-path')).to.equal('localhost/some-path');
    });

    it('converts with port', function () {
      expect(fn('http://localhost:3333/some-path')).to.equal('localhost/some-path');
    });

    it('decodes characters that url.parse encodes', function () {
      expect(fn('http://localhost:3333/author/person-l\'cool')).to.equal('localhost/author/person-l\'cool');
    });
  });

  describe('listDeepObjects', function () {
    const fn = lib[this.title];

    it('listDeepObjects gets all deep objects', function () {
      const result = fn({a:{b:{c:{d:'e'}}, f:{g:{h:'e'}}}});

      expect(result).to.have.length(5);
    });

    it('listDeepObjects can filter by existence of properties', function () {
      const result = fn({a:{b:{c:{d:'e'}}, f:{d:{g:'e'}}}}, 'd');

      expect(result).to.have.length(2);
    });

    it('listDeepObjects can filter by component', function () {
      const result = fn({a: {type:'yarn'}, b: {c: {type:'sweater'}}}, function (obj) { return !!obj.type; });

      expect(result).to.deep.equal([
        {type:'yarn'},
        {type:'sweater'}
      ]);
    });
  });
});
