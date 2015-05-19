'use strict';
var _ = require('lodash'),
  filename = __filename.split('/').pop().split('.').shift(),
  expect = require('chai').expect,
  sinon = require('sinon'),
  fs = require('fs'),
  path = require('path'),
  files = require('./' + filename);

describe(_.startCase(filename), function () {
  var dirStub, statStub, resolveStub, sandbox;

  function createMockStat(options) {
    return {
      isDirectory: _.constant(!!options.isDirectory)
    };
  }

  beforeEach(function () {
    sandbox = sinon.sandbox.create();
    dirStub = sandbox.stub(fs, 'readdirSync');
    statStub = sandbox.stub(fs, 'statSync');
    resolveStub = sandbox.stub(path, 'resolve');

    //clear the caches
    files.getFolders.cache = new _.memoize.Cache();
    files.getComponents.cache = new _.memoize.Cache();
    files.getComponentPath.cache = new _.memoize.Cache();
    files.getComponentModule.cache = new _.memoize.Cache();
  });

  afterEach(function () {
    sandbox.restore();
  });

  describe('getFolders', function () {
    it('gets a list of folders', function () {
      dirStub.returns(['isAFolder', 'isNotAFolder']);
      statStub.withArgs('isAFolder').returns(createMockStat({isDirectory: true}));
      statStub.withArgs('isNotAFolder').returns(createMockStat({isDirectory: false}));
      resolveStub.returnsArg(0);

      expect(files.getFolders('.')).to.contain('isAFolder');
    });
  });

  describe('getComponents', function () {
    it('gets a list of components', function () {
      dirStub.withArgs('components').returns(['c1', 'c2']);
      dirStub.withArgs('node_modules').returns(['byline-c3', 'byline-c4']);
      statStub.withArgs('components/c1').returns(createMockStat({isDirectory: true}));
      statStub.withArgs('components/c2').returns(createMockStat({isDirectory: false}));
      statStub.withArgs('node_modules/byline-c3').returns(createMockStat({isDirectory: true}));
      statStub.withArgs('node_modules/byline-c4').returns(createMockStat({isDirectory: false}));
      resolveStub.returnsArg(0);

      expect(files.getComponents()).to.contain('c1', 'c2', 'byline-c3', 'byline-c4');
    });
  });
});