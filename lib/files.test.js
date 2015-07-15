'use strict';
var _ = require('lodash'),
  filename = __filename.split('/').pop().split('.').shift(),
  expect = require('chai').expect,
  sinon = require('sinon'),
  fs = require('fs'),
  path = require('path'),
  files = require('./' + filename),
  pkg = require('../test/fixtures/config/package.json');

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

    // clear the caches
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
    it('gets a list of internal components', function () {
      dirStub.withArgs('components').returns(['c1', 'c2']);
      statStub.withArgs('components/c1').returns(createMockStat({isDirectory: true}));
      statStub.withArgs('components/c2').returns(createMockStat({isDirectory: false}));
      resolveStub.returnsArg(0);

      expect(files.getComponents()).to.contain('c1', 'c2');
    });

    it('gets a list of npm components', function () {
      dirStub.withArgs('components').returns([]);
      resolveStub.returnsArg(0);
      files.usePackage(pkg);

      expect(files.getComponents()).to.contain('byline-c3', 'byline-c4');
    });
  });

  describe('getComponentPath', function () {
    var fn = files[this.title],
      existsStub;

    beforeEach(function () {
      existsStub = sandbox.stub(fs, 'existsSync');
      sandbox.stub(files, 'getComponents').returns(['c1', 'byline-c5', 'byline-c3']);
      existsStub.returns(false);
      existsStub.withArgs('components/c1').returns(true);
      existsStub.withArgs('node_modules/byline-c3').returns(true);
      existsStub.withArgs('node_modules/@a/byline-c5').returns(true);
      resolveStub.withArgs('components', 'c1').returns('components/c1');
      resolveStub.withArgs('node_modules', 'byline-c3').returns('node_modules/byline-c3');
      resolveStub.withArgs('node_modules', '@a/byline-c5').returns('node_modules/@a/byline-c5');
      files.usePackage(pkg);
    });

    it('returns null if name isn\'t a component', function () {
      expect(fn('c0')).to.equal(null);
    });

    it('gets an internal path', function () {
      expect(fn('c1')).to.equal('components/c1');
    });

    it('gets an npm path', function () {
      expect(fn('byline-c3')).to.equal('node_modules/byline-c3');
    });

    it('gets a scoped npm path', function () {
      expect(fn('byline-c5')).to.equal('node_modules/@a/byline-c5');
    });
  });
});
