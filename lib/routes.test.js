'use strict';
const _ = require('lodash'),
  filename = __filename.split('/').pop().split('.').shift(),
  lib = require('./' + filename),
  expect = require('chai').expect,
  sinon = require('sinon'),
  files = require('./files'),
  siteService = require('./services/sites'),
  express = require('express');

function createMockRouter() {
  return {
    use: _.noop,
    all: _.noop,
    get: _.noop,
    put: _.noop,
    post: _.noop,
    delete: _.noop
  };
}

describe(_.startCase(filename), function () {
  let sandbox;

  beforeEach(function () {
    sandbox = sinon.sandbox.create();
  });

  afterEach(function () {
    sandbox.restore();
  });

  describe('addCORS', function () {
    const fn = lib[this.title];

    it('calls next with no settings', function (done) {
      const test = fn({});

      test({headers: {}}, {}, done);
    });

    it('responds to Origin header with Access-Control-Allow-Origin', function (done) {
      const spy = sandbox.spy(),
        test = fn({});

      test({headers: {origin: 'whatever'}}, {header: spy}, done);

      sinon.assert.calledWith(spy, 'Access-Control-Allow-Origin', '*');
    });

    it('responds to OPTIONS method', function (done) {
      let res,
        spy = sandbox.spy(),
        test = fn({});

      res = {header: spy, status() { return res; }, send: done};

      test({method: 'OPTIONS', headers: {}}, res);

      sinon.assert.calledWith(spy, 'Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE');
      sinon.assert.calledWith(spy, 'Access-Control-Allow-Headers', sinon.match.string);
    });
  });

  describe('sortByDepthOfPath', function () {
    const fn = lib[this.title];

    it('greater than', function () {
      expect(fn({path: '1/1'}, {path: '1'})).to.equal(1);
    });

    it('equal', function () {
      expect(fn({path: '01'}, {path: '1'})).to.equal(0);
    });

    it('less than', function () {
      expect(fn({path: '1'}, {path: '1/1'})).to.equal(-1);
    });
  });

  describe('getDefaultSiteSettings', function () {
    const fn = lib[this.title];

    it('www.example.com', function () {
      const hostname = 'www.example.com';

      expect(fn(hostname)).to.deep.equal({
        assetDir: 'public',
        host: hostname,
        name: 'Example',
        path: '/',
        prefix: 'www.example.com',
        slug: 'example'
      });
    });
  });

  describe('addSite', function () {
    const fn = lib[this.title];

    it('adds controllers', function () {
      const router = createMockRouter(),
        innerRouter = createMockRouter();

      sandbox.stub(express, 'Router', _.constant(innerRouter));
      sandbox.stub(files, 'fileExists');
      sandbox.stub(files, 'tryRequire');
      sandbox.stub(files, 'getFiles');
      sandbox.stub(siteService, 'sites');

      files.fileExists.returns(true);
      files.tryRequire.returns(_.noop);
      files.getFiles.returns(['a.b, c.d, e.f']);

      fn(router, {slug: 'example', assetDir: 'example'});

      sinon.assert.calledWith(files.tryRequire, './routes/a');
      sinon.assert.calledWith(files.tryRequire, './routes/a');
    });

    it('throws on bad site', function () {
      const router = createMockRouter(),
        innerRouter = createMockRouter();

      sandbox.stub(express, 'Router', _.constant(innerRouter));
      sandbox.stub(files, 'fileExists');
      sandbox.stub(files, 'tryRequire');
      sandbox.stub(siteService, 'sites');

      files.fileExists.returns(true);
      siteService.sites.returns({example: {
        slug: 'example',
        assetDir: 'example'
      }});

      expect(function () {
        fn(router, {slug: 'badsite'});
      }).to.throw();
    });

    it('throws on missing asset folder', function () {
      const router = createMockRouter(),
        innerRouter = createMockRouter();

      sandbox.stub(express, 'Router', _.constant(innerRouter));
      sandbox.stub(files, 'fileExists');
      sandbox.stub(files, 'tryRequire');
      sandbox.stub(siteService, 'sites');

      files.fileExists.returns(false);
      siteService.sites.returns({example: {
        slug: 'example',
        assetDir: 'example'
      }});

      expect(function () {
        fn(router, {slug: 'example'});
      }).to.throw();
    });
  });

  describe('loadFromConfig', function () {
    const fn = lib;

    it('is missing the site router but still works', function () {
      const router = createMockRouter(),
        innerRouter = createMockRouter();

      sandbox.stub(express, 'Router', _.constant(innerRouter));
      sandbox.stub(files, 'fileExists');
      sandbox.stub(files, 'tryRequire');
      sandbox.stub(siteService, 'sites');

      files.fileExists.returns(true);
      files.tryRequire.returns(_.noop);
      siteService.sites.returns({example: { host: 'example', slug: 'example', assetDir: 'example', dir: 'example' }});

      fn(router, {slug: 'example'});
    });

    it('has the site router but it is a noop', function () {
      const router = createMockRouter(),
        innerRouter = createMockRouter();

      sandbox.stub(express, 'Router', _.constant(innerRouter));
      sandbox.stub(files, 'fileExists');
      sandbox.stub(files, 'tryRequire');
      sandbox.stub(siteService, 'sites');

      files.tryRequire.returns(_.noop);
      files.fileExists.returns(true);
      siteService.sites.returns({example: { host: 'example', slug: 'example', assetDir: 'example', dir: 'example' }});

      fn(router, {slug: 'example'});
    });
  });

  describe('addSiteController', function () {
    const fn = lib[this.title];

    it('does nothing is there is no site directory', function () {
      const router = {},
        site = {};

      fn(router, site);
    });

    it('does nothing if loading site controller fails', function () {
      const siteDir = 'some-location',
        router = {},
        site = {dir: siteDir};

      sandbox.stub(files, 'tryRequire');

      files.tryRequire.returns(false);

      fn(router, site);
    });

    it('does nothing if site controller is not a function', function () {
      const siteDir = 'some-location',
        router = {},
        site = {dir: siteDir};

      sandbox.stub(files, 'tryRequire');

      files.tryRequire.returns({});

      fn(router, site);
    });

    it('remembers resolveMedia from controller', function () {
      const siteDir = 'some-location',
        router = {},
        site = {dir: siteDir};

      sandbox.stub(files, 'tryRequire');

      files.tryRequire.returns({});

      fn(router, site);
    });
  });
});
