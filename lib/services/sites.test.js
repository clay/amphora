'use strict';
const _ = require('lodash'),
  filename = __filename.split('/').pop().split('.').shift(),
  expect = require('chai').expect,
  sinon = require('sinon'),
  fs = require('fs'),
  files = require('../files'),
  path = require('path'),
  lib = require('./' + filename);

describe(_.startCase(filename), function () {
  let sandbox, logSpy,
    mockSites = {
      a: {
        dir: 'z/a',
        slug: 'a',
        host: 'd',
        path: '/e',
        prefix: 'd/e',
        assetDir: 'public',
        assetPath: '/e',
        protocol: 'http'
      },
      b: {
        dir: 'z/b',
        slug: 'b',
        host: 'd',
        path: '/e',
        prefix: 'd/e',
        assetDir: 'public',
        assetPath: '/e',
        protocol: 'http'
      },
      c: {
        dir: 'z/c',
        slug: 'c',
        host: 'h',
        path: '/i/j',
        prefix: 'h/i/j',
        assetDir: 'public',
        assetPath: '/i/j',
        protocol: 'http'
      }
    },
    mockSitesWithoutPaths = {
      a: {
        dir: 'z/a',
        slug: 'a',
        host: 'd',
        path: '',
        prefix: 'd',
        assetDir: 'public',
        assetPath: '',
        protocol: 'http'
      },
      b: {
        dir: 'z/b',
        slug: 'b',
        host: 'd',
        path: '',
        prefix: 'd',
        assetDir: 'public',
        assetPath: '',
        protocol: 'http'
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
      path: 'e',
      assetPath: 'e',
      protocol: 'http'
    };
  }

  function getMockSiteWithoutPath() {
    return {
      slug: 'c',
      host: 'd'
    };
  }

  function getMockSiteWithoutProtocol() {
    return {
      slug: 'c',
      host: 'd',
      path: 'e',
      assetPath: 'e'
    };
  }

  beforeEach(function () {
    sandbox = sinon.sandbox.create();
    logSpy = sandbox.spy();

    lib.setLog(logSpy);
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
    const fn = lib[this.title];

    it('gets', function () {
      files.getFolders.returns(['a', 'b', 'c']);
      path.resolve.returns('z');
      files.getYaml.onFirstCall().returns(getMockSite());
      files.getYaml.onSecondCall().returns(getMockSite());
      files.getYaml.onThirdCall().returns(getMockSite());
      files.getYaml.onCall(4).returns({
        assetPath: '/i/j',
        host: 'h',
        path: '/i/j',
        prefix: 'h/i/j'
      });

      expect(fn()).to.deep.equal(mockSites);
    });

    it('gets prefix for site without path', function () {
      files.getFolders.returns(['a', 'b']);
      path.resolve.returns('z');
      files.getYaml.onFirstCall().returns(getMockSiteWithoutPath());
      files.getYaml.onSecondCall().returns(getMockSiteWithoutPath());
      files.getYaml.onThirdCall().returns(getMockSiteWithoutPath());

      expect(fn()).to.deep.equal(mockSitesWithoutPaths);
    });

    it('throw error on missing host', function () {
      files.getFolders.returns(['a', 'b']);
      path.resolve.returns('z');
      files.getYaml.onFirstCall().returns(getMockBadSite());
      files.getYaml.onSecondCall().returns(getMockBadSite());

      expect(function () { fn(); }).to.throw();
    });

    it('logs a warning and does not attach a site with no config file', function () {
      var sites;

      files.getFolders.returns(['a']);
      path.resolve.returns('z');
      files.getYaml.onFirstCall().returns(null);
      files.getYaml.onSecondCall().returns({});

      sites = fn();
      sinon.assert.calledWith(logSpy, 'warn', 'No site config file found for site \'a\', please make sure one is included');
      expect(sites).to.eql({});
    });

    it('adds in the `protocol` property and logs warning if it is not on the config', function () {
      files.getFolders.returns(['a', 'b', 'c']);
      path.resolve.returns('z');
      files.getYaml.onFirstCall().returns(getMockSiteWithoutProtocol());
      files.getYaml.onSecondCall().returns(getMockSiteWithoutProtocol());
      files.getYaml.onThirdCall().returns(getMockSiteWithoutProtocol());
      files.getYaml.onCall(4).returns({
        assetPath: '/i/j',
        host: 'h',
        path: '/i/j',
        prefix: 'h/i/j'
      });

      expect(fn()).to.deep.equal(mockSites);
      sinon.assert.calledWith(logSpy, 'warn', 'A protocol property (\'http\' or \'https\') was not found for site \'a\', it will default to \'http\'');
    });
  });

  describe('get', function () {
    const fn = lib[this.title];

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

  describe('getSiteFromPrefix', function () {
    const fn = lib[this.title];

    it('gets from prefix', function () {
      sandbox.stub(lib, 'sites').returns(mockSites);

      expect(fn('d/e')).to.eql(mockSites.a);
    });

    it('gets from prefix for sites with multiple slashes in the path', function () {
      sandbox.stub(lib, 'sites').returns(mockSites);
      expect(fn('h/i/j')).to.eql(mockSites.c);
    });

    it('returns undefined if the site cannot be found', function () {
      sandbox.stub(lib, 'sites').returns(mockSites);
      expect(fn('h/i')).to.be.undefined;
    });

    it('returns the site if the host and prefix are the same', function () {
      sandbox.stub(lib, 'sites').returns(mockSitesWithoutPaths);
      expect(fn('d')).to.eql(mockSitesWithoutPaths.a);
    });
  });

  describe('normalizePath', function () {
    const fn = lib[this.title];

    it('allows blank', function () {
      expect(fn()).to.equal('');
    });

    it('converts single / to blank', function () {
      expect(fn('/')).to.equal('');
    });

    it('always begins with and never ends with /', function () {
      const normalized = '/some/path';

      expect(fn('some/path')).to.equal(normalized);
      expect(fn('some/path/')).to.equal(normalized);
      expect(fn('/some/path')).to.equal(normalized);
      expect(fn('/some/path/')).to.equal(normalized);
    });
  });

  describe('normalizeDirectory', function () {
    const fn = lib[this.title];

    it('always exists', function () {
      expect(fn()).to.equal('.');
    });

    it('does not allow single slash', function () {
      expect(fn(path.sep)).to.equal('.');
    });

    it('never begins with and never ends with /', function () {
      const normalized = ['some', path.sep, 'path'].join('');

      expect(fn(['some', path.sep, 'path'].join(''))).to.equal(normalized);
      expect(fn(['some', path.sep, 'path'].join('') + path.sep)).to.equal(normalized);
      expect(fn(path.sep + ['some', path.sep, 'path'].join(''))).to.equal(normalized);
      expect(fn(path.sep + ['some', path.sep, 'path'].join('') + path.sep)).to.equal(normalized);
    });
  });
});
