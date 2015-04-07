'use strict';
var mockFS = require('mock-fs'),
  expect = require('chai').expect,
  sinon = require('sinon'),
  fs = require('fs'),
  files = require('./files');

describe('files', function () {
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
  });

  afterEach(function () {
    sandbox.restore();
  });

  after(function () {
    mockFS.restore();
  });

  describe('getFolders()', function () {
    it('gets a list of folders', function () {
      expect(files.getFolders('.')).to.contain('components', 'sites', 'node_modules');
    });
  });

  describe('getSites()', function () {
    it('gets a list of sites', function () {
      expect(files.getSites()).to.contain('site1', 'site2');
    });
  });

  describe('getComponents()', function () {
    it('gets a list of components', function () {
      expect(files.getComponents()).to.contain('c1', 'c2', 'byline-c3', 'byline-c4');
    });
  });
});