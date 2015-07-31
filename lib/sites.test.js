'use strict';
var _ = require('lodash'),
  filename = __filename.split('/').pop().split('.').shift(),
  expect = require('chai').expect,
  sinon = require('sinon'),
  fs = require('fs'),
  files = require('./files'),
  path = require('path'),
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
    sandbox.stub(path, 'resolve');
    sandbox.stub(yaml, 'safeLoad', getMockSite);
    sandbox.stub(files, 'getFolders');

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
      files.getFolders.returns(['a', 'b']);
      path.resolve.returns('z');

      expect(fn()).to.deep.equal({
        a: {
          dirPath: 'z/a',
          slug: 'a',
          host: 'd',
          path: '/e'
        },
        b: {
          dirPath: 'z/b',
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
      files.getFolders.returns(['a', 'b']);
      path.resolve.returns('z');

      expect(fn()).to.deep.equal(['d']);
    });
  });
});