'use strict';
var _ = require('lodash'),
  filename = _.startCase(__filename.split('/').pop().split('.').shift()),
  mockFS = require('mock-fs'),
  expect = require('chai').expect,
  sinon = require('sinon'),
  fs = require('fs'),
  files = require('./files');

describe(filename, function () {
  var mock, sandbox;

  before(function () {
    mock = mockFS.fs({
      components: {
        c1: {},
        c2: {}
      },
      sites: {
        site1: {},
        site2: {}
      },
      node_modules: { // jshint ignore:line
        'byline-c3': {},
        'byline-c4': {}
      }
    });
  });

  beforeEach(function () {
    sandbox = sinon.sandbox.create();
    // stub out fs methods
    sandbox.stub(fs, 'existsSync', mock.existsSync);
    sandbox.stub(fs, 'readdirSync', mock.readdirSync);
    sandbox.stub(fs, 'statSync', mock.statSync);
    //clear the caches
    files.getFolders.cache = new _.memoize.Cache();
    files.getSites.cache = new _.memoize.Cache();
    files.getComponents.cache = new _.memoize.Cache();
    files.getComponentPath.cache = new _.memoize.Cache();
    files.getComponentModule.cache = new _.memoize.Cache();
  });

  afterEach(function () {
    sandbox.restore();
  });

  after(function () {
    mockFS.restore();
  });

  describe('getFolders', function () {
    it('gets a list of folders', function () {
      expect(files.getFolders('.')).to.contain('components', 'sites', 'node_modules');
    });

    it('returns empty array if arg is not a folder', function () {
      expect(files.getFolders('foo')).to.eql([]);
    });
  });

  describe('getSites', function () {
    it('gets a list of sites', function () {
      expect(files.getSites()).to.contain('site1', 'site2');
    });
  });

  describe('getComponents', function () {
    it('gets a list of components', function () {
      expect(files.getComponents()).to.contain('c1', 'c2', 'byline-c3', 'byline-c4');
    });
  });

  describe('getComponentName', function () {
    it('gets a node_modules component name', function () {
      expect(files.getComponentName('node_modules/bar')).to.equal('bar');
      expect(files.getComponentName('foo/node_modules/bar')).to.equal('bar');
      expect(files.getComponentName('foo/node_modules/bar/baz.css')).to.equal('bar');
    });

    it('gets a components/ name', function () {
      expect(files.getComponentName('components/bar')).to.equal('bar');
      expect(files.getComponentName('foo/components/bar')).to.equal('bar');
      expect(files.getComponentName('foo/components/bar/baz.css')).to.equal('bar');
    });
  });
});