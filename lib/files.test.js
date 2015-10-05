'use strict';
var _ = require('lodash'),
  filename = __filename.split('/').pop().split('.').shift(),
  expect = require('chai').expect,
  sinon = require('sinon'),
  fs = require('fs'),
  path = require('path'),
  yaml = require('js-yaml'),
  glob = require('glob'),
  lib = require('./' + filename),
  pkg = require('../test/fixtures/config/package.json');

describe(_.startCase(filename), function () {
  var req, sandbox;

  function createMockStat(options) {
    return {
      isDirectory: _.constant(!!options.isDirectory)
    };
  }

  beforeEach(function () {
    sandbox = sinon.sandbox.create();
    sandbox.stub(fs);
    sandbox.stub(path, 'resolve');
    sandbox.stub(yaml);
    sandbox.stub(glob, 'sync');

    // clear the caches
    lib.getYaml.cache = new _.memoize.Cache();
    lib.getFiles.cache = new _.memoize.Cache();
    lib.getFolders.cache = new _.memoize.Cache();
    lib.getComponents.cache = new _.memoize.Cache();
    lib.getComponentPath.cache = new _.memoize.Cache();
    lib.getComponentModule.cache = new _.memoize.Cache();
    lib.getComponentPackage.cache = new _.memoize.Cache();
    lib.isDirectory.cache = new _.memoize.Cache();
    lib.fileExists.cache = new _.memoize.Cache();

    //package file can never be real
    lib.setPackageConfiguration(pkg);

    //require shouldn't be called dynamically, but here we go
    req = sandbox.stub();
    lib.setRequire(req);
  });

  afterEach(function () {
    sandbox.restore();
  });

  describe('getFolders', function () {
    var fn = lib[this.title];

    it('gets a list of folders', function () {
      fs.readdirSync.returns(['isAFolder', 'isNotAFolder']);
      fs.statSync.withArgs('isAFolder').returns(createMockStat({isDirectory: true}));
      fs.statSync.withArgs('isNotAFolder').returns(createMockStat({isDirectory: false}));
      path.resolve.returnsArg(0);

      expect(fn('.')).to.contain('isAFolder');
    });
  });

  describe('getComponents', function () {
    var fn = lib[this.title];

    it('gets a list of internal components', function () {
      fs.readdirSync.withArgs('components').returns(['c1', 'c2']);
      fs.statSync.withArgs('components/c1').returns(createMockStat({isDirectory: true}));
      fs.statSync.withArgs('components/c2').returns(createMockStat({isDirectory: false}));
      path.resolve.returnsArg(0);

      expect(fn()).to.contain('c1', 'c2');
    });

    it('gets a list of npm components', function () {
      fs.readdirSync.withArgs('components').returns([]);
      path.resolve.returnsArg(0);

      expect(fn()).to.contain('clay-c3', 'clay-c4');
    });
  });

  describe('getComponentPath', function () {
    var fn = lib[this.title];

    beforeEach(function () {
      sandbox.stub(lib, 'getComponents');
      lib.getComponents.returns(['c1', 'clay-c5', 'clay-c3']);
      fs.existsSync.returns(false);
      fs.existsSync.withArgs('components/c1').returns(true);
      fs.existsSync.withArgs('node_modules/clay-c3').returns(true);
      fs.existsSync.withArgs('node_modules/@a/clay-c5').returns(true);
      path.resolve.withArgs('components', 'c1').returns('components/c1');
      path.resolve.withArgs('node_modules', 'clay-c3').returns('node_modules/clay-c3');
      path.resolve.withArgs('node_modules', '@a/clay-c5').returns('node_modules/@a/clay-c5');
    });

    it('returns null if name isn\'t a component', function () {
      expect(fn('c0')).to.equal(null);
    });

    it('gets an internal path', function () {
      expect(fn('c1')).to.equal('components/c1');
    });

    it('gets an npm path', function () {
      expect(fn('clay-c3')).to.equal('node_modules/clay-c3');
    });

    it('gets a scoped npm path', function () {
      expect(fn('clay-c5')).to.equal('node_modules/@a/clay-c5');
    });
  });

  describe('getYaml', function () {
    var fn = lib[this.title];

    it('returns result', function () {
      var filename = 'some-name',
        result = 'some result';

      yaml.safeLoad.returns(result);

      expect(fn(filename)).to.equal(result);
    });

    it('returns result from first file', function () {
      var filename = 'some-name',
        result = 'some result';

      fs.readFileSync.onCall(0).returns(result);
      fs.readFileSync.onCall(1).throws();
      yaml.safeLoad.returnsArg(0);

      expect(fn(filename)).to.equal(result);
    });

    it('returns result from second file', function () {
      var filename = 'some-name',
        result = 'some result';

      fs.readFileSync.onCall(0).throws();
      fs.readFileSync.onCall(1).returns(result);
      yaml.safeLoad.returnsArg(0);

      expect(fn(filename)).to.equal(result);
    });
  });

  describe('getComponentModule', function () {
    var fn = lib[this.title];

    beforeEach(function () {
      sandbox.stub(lib, 'getComponentPath');
    });

    it('handles missing name', function () {
      expect(fn()).to.equal();
    });

    it('handles bad name', function () {
      var name = 'some name';

      expect(fn(name)).to.equal();
    });

    it('handles bad path', function () {
      var name = 'some name';

      lib.getComponentPath.returns(null);

      expect(fn(name)).to.equal(null);
    });

    it('handles index.js path', function () {
      var name = 'some name',
        path = 'some path',
        result = 'some result';

      lib.getComponentPath.returns(path);
      req.withArgs(path).returns(result);

      expect(fn(name)).to.equal(result);
    });

    it('handles server.js path', function () {
      var name = 'some name',
        path = 'some path',
        result = 'some result';

      lib.getComponentPath.returns(path);
      req.withArgs(path + '/server').returns(result);

      expect(fn(name)).to.equal(result);
    });
  });

  describe('getComponentPackage', function () {
    var fn = lib[this.title];

    beforeEach(function () {
      sandbox.stub(lib, 'getComponentPath');
    });

    it('handles missing name', function () {
      expect(fn()).to.equal();
    });

    it('handles bad name', function () {
      var name = 'some name';

      expect(fn(name)).to.equal();
    });

    it('handles bad path', function () {
      var name = 'some name';

      lib.getComponentPath.returns(null);

      expect(fn(name)).to.equal(null);
    });

    it('handles index.js path', function () {
      var name = 'some name',
        path = 'some path',
        result = [];

      lib.getComponentPath.returns(path);
      req.withArgs(path + '/package.json').returns(result);

      expect(fn(name)).to.equal(result);
    });
  });
});
