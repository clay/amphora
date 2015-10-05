'use strict';
var _ = require('lodash'),
  filename = __filename.split('/').pop().split('.').shift(),
  expect = require('chai').expect,
  sinon = require('sinon'),
  fs = require('fs'),
  files = require('../files'),
  path = require('path'),
  lib = require('./' + filename);

describe(_.startCase(filename), function () {
  var sandbox,
    mockSites = {
      a: {
        dir: 'z/a',
        slug: 'a',
        host: 'd',
        path: '/e',
        assetDir: 'public',
        assetPath: '/'
      },
      b: {
        dir: 'z/b',
        slug: 'b',
        host: 'd',
        path: '/e',
        assetDir: 'public',
        assetPath: '/'
      }
    };

  function getMockBadSite() {
    return {
      path: 'e'
    };
  }

  function getMockSite() {
    return {
      slug: 'c',
      host: 'd',
      path: 'e'
    };
  }

  beforeEach(function () {
    sandbox = sinon.sandbox.create();
    sandbox.stub(fs, 'readFileSync');
    sandbox.stub(path, 'resolve');
    sandbox.stub(files, 'getFolders');
    sandbox.stub(files, 'getYaml');

    // clear the caches
    lib.sites.cache = new _.memoize.Cache();
  });

  afterEach(function () {
    sandbox.restore();
  });

  describe('sites', function () {
    var fn = lib[this.title];

    it('gets', function () {
      files.getFolders.returns(['a', 'b']);
      path.resolve.returns('z');
      files.getYaml.onFirstCall().returns(getMockSite());
      files.getYaml.onSecondCall().returns(getMockSite());
      files.getYaml.onThirdCall().returns(getMockSite());

      expect(fn()).to.deep.equal(mockSites);
    });

    it('throw error on missing host', function () {
      files.getFolders.returns(['a', 'b']);
      path.resolve.returns('z');
      files.getYaml.onFirstCall().returns(getMockBadSite());
      files.getYaml.onSecondCall().returns(getMockBadSite());

      expect(function () { fn(); }).to.throw();
    });
  });

  describe('get', function () {
    var fn = lib[this.title];

    it('gets a site with a specific host and path', function () {
      sandbox.stub(lib, 'sites').returns(mockSites);

      expect(fn('d', '/e')).to.eql(mockSites.a);
    });

    it('returns undefined if no host matches', function () {
      sandbox.stub(lib, 'sites').returns(mockSites);

      expect(fn('e', '/e')).to.eql(undefined);
    });

    it('returns undefined if no path matches', function () {
      sandbox.stub(lib, 'sites').returns(mockSites);

      expect(fn('d', '/f')).to.eql(undefined);
    });
  });

  describe('normalizePath', function () {
    var fn = lib[this.title];

    it('always exists', function () {
      expect(fn()).to.equal('/');
    });

    it('allows single slash', function () {
      expect(fn('/')).to.equal('/');
    });

    it('always begins with and never ends with /', function () {
      var normalized = '/some/path';

      expect(fn('some/path')).to.equal(normalized);
      expect(fn('some/path/')).to.equal(normalized);
      expect(fn('/some/path')).to.equal(normalized);
      expect(fn('/some/path/')).to.equal(normalized);
    });
  });

  describe('normalizeDirectory', function () {
    var fn = lib[this.title];

    it('always exists', function () {
      expect(fn()).to.equal('.');
    });

    it('does not allow single slash', function () {
      expect(fn(path.sep)).to.equal('.');
    });

    it('never begins with and never ends with /', function () {
      var normalized = ['some', path.sep, 'path'].join('');

      expect(fn(['some', path.sep, 'path'].join(''))).to.equal(normalized);
      expect(fn(['some', path.sep, 'path'].join('') + path.sep)).to.equal(normalized);
      expect(fn(path.sep + ['some', path.sep, 'path'].join(''))).to.equal(normalized);
      expect(fn(path.sep + ['some', path.sep, 'path'].join('') + path.sep)).to.equal(normalized);
    });
  });
});
