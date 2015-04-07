'use strict';
var mock = require('mock-fs'),
  expect = require('chai').expect,
  files = require('./files');

describe('files', function () {
  before(function () {
    mock({
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

  after(function () {
    mock.restore();
  });

  describe('getFolders()', function () {
    it('gets a list of folders', function () {
      expect(files.getFolders('.')).to.contain('components', 'sites', 'node_modules');
    });

    it('returns empty array if arg is not a folder', function () {
      expect(files.getFolders('foo')).to.eql([]);
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