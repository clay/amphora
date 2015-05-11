'use strict';
var _ = require('lodash'),
  filename = _.startCase(__filename.split('/').pop().split('.').shift()),
  lib = require('./' + filename),
  expect = require('chai').expect,
  sinon = require('sinon'),
  files = require('./files'),
  db = require('./db'),
  schema = require('./schema'),
  config = require('config'),
  glob = require('glob'),
  bluebird = require('bluebird'),
  express = require('express');

describe(filename, function () {
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

    it('www.example.com/whatever/what', function () {
      var hostname = 'www.example.com/whatever/what';
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
      sandbox.mock(files).expects('getFiles').returns([]);

      fn(router);

      sandbox.verify();
    });
  });
});