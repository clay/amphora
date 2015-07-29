'use strict';
var _ = require('lodash'),
  filename = __filename.split('/').pop().split('.').shift(),
  expect = require('chai').expect,
  sinon = require('sinon'),
  fs = require('fs'),
  files = require('./files'),
  yaml = require('js-yaml'),
  lib = require('./' + filename);

describe(_.startCase(filename), function () {
  var sandbox;

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

    // clear the caches
    lib.sites.cache = new _.memoize.Cache();
    lib.hosts.cache = new _.memoize.Cache();
  });

  afterEach(function () {
    sandbox.restore();
  });

  describe('sites', function () {
    var fn = lib[this.title];

    it('gets', function () {
      sandbox.stub(files, 'getFolders').returns(['a', 'b']);
      sandbox.stub(yaml, 'safeLoad', getMockSite);

      var result = fn();

      expect(result).to.deep.equal({
        a: {
          slug: 'a',
          host: 'd',
          path: '/e'
        },
        b: {
          slug: 'b',
          host: 'd',
          path: '/e'
        }
      });
    });
  });

  describe('hosts', function () {
    var fn = lib[this.title];

    it('gets', function () {
      sandbox.stub(files, 'getFolders').returns(['a', 'b']);
      sandbox.stub(yaml, 'safeLoad', getMockSite);

      var result = fn();

      expect(result).to.deep.equal(['d']);
    });
  });
});