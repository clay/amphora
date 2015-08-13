'use strict';
var _ = require('lodash'),
  filename = __filename.split('/').pop().split('.').shift(),
  lib = require('./' + filename),
  expect = require('chai').expect,
  sinon = require('sinon'),
  files = require('./files'),
  siteService = require('./sites'),
  express = require('express');

describe(_.startCase(filename), function () {
  var sandbox;

  beforeEach(function () {
    sandbox = sinon.sandbox.create();
  });

  afterEach(function () {
    sandbox.restore();
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

    function createMockRouter() {
      return {
        use: _.noop,
        all: _.noop,
        get: _.noop,
        put: _.noop,
        post: _.noop
      };
    }

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
  });
});