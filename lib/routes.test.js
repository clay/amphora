'use strict';
var _ = require('lodash'),
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
  var sandbox;

  beforeEach(function () {
    sandbox = sinon.sandbox.create();
  });

  afterEach(function () {
    sandbox.restore();
  });

  describe('addCORS', function () {
    var fn = lib[this.title];

    it('calls next with no settings', function (done) {
      var test = fn({});

      test({headers: {}}, {}, done);
    });

    it('responds to Origin header with Access-Control-Allow-Origin', function (done) {
      var spy = sandbox.spy(),
        test = fn({});

      test({headers: {origin: 'whatever'}}, {header: spy}, done);

      sinon.assert.calledWith(spy, 'Access-Control-Allow-Origin', '*');
    });

    it('responds to OPTIONS method', function (done) {
      var res,
        spy = sandbox.spy(),
        test = fn({});

      res = {header: spy, status: function () { return res; }, send: done};

      test({method: 'OPTIONS', headers: {}}, res);

      sinon.assert.calledWith(spy, 'Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE');
      sinon.assert.calledWith(spy, 'Access-Control-Allow-Headers', sinon.match.string);
    });
  });

  describe('sortByDepthOfPath', function () {
    var fn = lib[this.title];

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
    var fn = lib[this.title];

    it('www.example.com', function () {
      var hostname = 'www.example.com';
      expect(fn(hostname)).to.deep.equal({
        host: hostname,
        name: 'Example',
        path: '/',
        slug: 'example'
      });
    });
  });

  describe('addSite', function () {
    var fn = lib[this.title];

    it('adds controllers', function () {
      var router = createMockRouter(),
        innerRouter = createMockRouter();

      sandbox.stub(express, 'Router', _.constant(innerRouter));
      sandbox.stub(files, 'fileExists');
      sandbox.stub(siteService, 'sites');

      files.fileExists.returns(true);
      siteService.sites.returns({example: {
        slug: 'example',
        assetDir: 'example'
      }});

      // checking for the files to use as controllers shows that we entered the right function.
      // until we add more functionality here, this is good enough.
      sandbox.mock(files).expects('getFiles').returns([]);

      fn(router, {slug: 'example'});

      sandbox.verify();
    });

    it('throws on bad site', function () {
      var router = createMockRouter(),
        innerRouter = createMockRouter();

      sandbox.stub(express, 'Router', _.constant(innerRouter));
      sandbox.stub(files, 'fileExists');
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
      var router = createMockRouter(),
        innerRouter = createMockRouter();

      sandbox.stub(express, 'Router', _.constant(innerRouter));
      sandbox.stub(files, 'fileExists');
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
    var fn = lib;

    it('is missing the site router but still works', function () {
      var router = createMockRouter(),
        innerRouter = createMockRouter();

      sandbox.stub(express, 'Router', _.constant(innerRouter));
      sandbox.stub(files, 'fileExists');
      sandbox.stub(siteService, 'sites');

      files.fileExists.returns(true);
      siteService.sites.returns({example: { host: 'example', slug: 'example', assetDir: 'example', dir: 'example' }});

      fn(router, {slug: 'example'});
    });

    it('has the site router but it is a noop', function () {
      var router = createMockRouter(),
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
});
