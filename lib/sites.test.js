'use strict';
var _ = require('lodash'),
  filename = __filename.split('/').pop().split('.').shift(),
  expect = require('chai').expect,
  sinon = require('sinon'),
  fs = require('fs'),
  files = require('./files'),
  path = require('path'),
  lib = require('./' + filename);

describe(_.startCase(filename), function () {
  var sandbox;

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
      files.getYaml.onFirstCall().returns(getMockSite());
      files.getYaml.onSecondCall().returns(getMockSite());
      files.getYaml.onThirdCall().returns(getMockSite());

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

    it('throw error on missing host', function () {
      files.getFolders.returns(['a', 'b']);
      path.resolve.returns('z');
      files.getYaml.onFirstCall().returns(getMockBadSite());
      files.getYaml.onSecondCall().returns(getMockBadSite());

      expect(function () { fn(); }).to.throw();
    });
  });

  describe('hosts', function () {
    var fn = lib[this.title];

    it('gets', function () {
      files.getFolders.returns(['a', 'b']);
      path.resolve.returns('z');
      files.getYaml.onFirstCall().returns(getMockSite());
      files.getYaml.onSecondCall().returns(getMockSite());
      files.getYaml.onThirdCall().returns(getMockSite());

      expect(fn()).to.deep.equal(['d']);
    });
  });
});