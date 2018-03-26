'use strict';

const _ = require('lodash'),
  filename = __filename.split('/').pop().split('.').shift(),
  expect = require('chai').expect,
  sinon = require('sinon'),
  fs = require('fs'),
  path = require('path'),
  yaml = require('js-yaml'),
  glob = require('glob'),
  lib = require('./' + filename),
  log = require('./services/logger'),
  temp2env = require('template2env');

describe(_.startCase(filename), function () {
  let req, sandbox;

  function createMockStat(options) {
    return {
      isDirectory: _.constant(!!options.isDirectory)
    };
  }

  beforeEach(function () {
    sandbox = sinon.sandbox.create();
    sandbox.stub(fs, 'statSync');
    sandbox.stub(fs, 'readdirSync');
    sandbox.stub(fs, 'existsSync');
    sandbox.stub(fs, 'readFileSync');
    sandbox.stub(path, 'resolve');
    sandbox.stub(yaml);
    sandbox.stub(log);
    sandbox.stub(glob, 'sync');
    sandbox.stub(temp2env);

    // clear the caches
    lib.getYaml.cache = new _.memoize.Cache();
    lib.getFiles.cache = new _.memoize.Cache();
    lib.getFolders.cache = new _.memoize.Cache();
    lib.getComponentModule.cache = new _.memoize.Cache();
    lib.getComponentPackage.cache = new _.memoize.Cache();
    lib.isDirectory.cache = new _.memoize.Cache();
    lib.fileExists.cache = new _.memoize.Cache();
    lib.tryRequire.cache = new _.memoize.Cache();

    // package file can never be real
    // lib.setPackageConfiguration(pkg);

    // require shouldn't be called dynamically, but here we go
    req = sandbox.stub();
    req.resolve = sandbox.stub();
    lib.setRequire(req);
  });

  afterEach(function () {
    sandbox.restore();
    lib.setRequire(require);
  });

  describe('fileExists', function () {
    const fn = lib[this.title];

    it('is true if exists', function () {
      fs.statSync.returns({});

      expect(fn('a')).to.equal(true);
    });

    it('is false if falsy', function () {
      expect(fn('a')).to.equal(false);
    });

    it('is false if throws', function () {
      fs.statSync.throws();

      expect(fn('a')).to.equal(false);
    });
  });

  describe('getFiles', function () {
    const fn = lib[this.title];

    it('gets a list of folders', function () {
      fs.readdirSync.returns(['isAFile', 'isADirectory']);
      fs.statSync.withArgs('isAFile').returns(createMockStat({isDirectory: false}));
      fs.statSync.withArgs('isADirectory').returns(createMockStat({isDirectory: true}));
      path.resolve.returnsArg(0);

      expect(fn('.')).to.contain('isAFile');
    });

    it('returns empty array on error', function () {
      fs.readdirSync.throws();

      expect(fn('.')).to.deep.equal([]);
    });
  });


  describe('getFolders', function () {
    const fn = lib[this.title];

    it('gets a list of folders', function () {
      fs.readdirSync.returns(['isAFolder', 'isNotAFolder']);
      fs.statSync.withArgs('isAFolder').returns(createMockStat({isDirectory: true}));
      fs.statSync.withArgs('isNotAFolder').returns(createMockStat({isDirectory: false}));
      path.resolve.returnsArg(0);

      expect(fn('.')).to.contain('isAFolder');
    });
  });

  describe('getYaml', function () {
    let fn = lib[this.title],
      myEnvFile = 'myEnvFile',
      original;

    beforeEach(function () {
      original = lib.getAllowedEnvFiles();
      lib.setAllowedEnvFiles([myEnvFile]);
    });

    afterEach(function () {
      lib.setAllowedEnvFiles(original);
    });

    it('returns result', function () {
      const filename = 'some-name',
        result = 'some result';

      yaml.safeLoad.returns(result);

      expect(fn(filename)).to.equal(result);
    });

    it('returns result from first file', function () {
      const filename = 'some-name',
        result = 'some result';

      fs.readFileSync.onCall(0).returns(result);
      fs.readFileSync.onCall(1).throws();
      yaml.safeLoad.returnsArg(0);

      expect(fn(filename)).to.equal(result);
    });

    it('returns result from second file', function () {
      const filename = 'some-name',
        result = 'some result';

      fs.readFileSync.onCall(0).throws();
      fs.readFileSync.onCall(1).returns(result);
      yaml.safeLoad.returnsArg(0);

      expect(fn(filename)).to.equal(result);
    });

    it('runs temp2env when filename allows env\'s', function () {
      const result = 'some result';

      fs.readFileSync.returns(result);
      temp2env.interpolate.returns(result);

      fn(myEnvFile);

      sinon.assert.calledOnce(temp2env.interpolate);
    });

    it('doesn\'t run temp2env when filename doesn\'t allow env\'s', function () {
      const filename = 'something different',
        result = 'some result';

      fs.readFileSync.returns(result);
      temp2env.interpolate.returns(result);

      fn(filename);

      sinon.assert.notCalled(temp2env.interpolate);
    });
  });

  describe('getComponentModule', function () {
    const fn = lib[this.title];

    beforeEach(function () {
      sandbox.stub(lib, 'getComponentPath');
    });

    it('handles missing name', function () {
      expect(fn()).to.equal();
    });

    it('handles bad name', function () {
      const name = 'some name';

      expect(fn(name)).to.equal();
    });

    it('handles bad path', function () {
      const name = 'some name';

      lib.getComponentPath.returns(null);

      expect(fn(name)).to.equal(null);
    });

    it('throws an error if the module exists but cannot be required successfully', function () {
      const name = 'some name',
        path = 'some path';

      req.resolve.returns('/some-path');
      req.throws(new Error('some error'));
      lib.getComponentPath.returns(path);

      expect(function () { fn(name); }).to.throw();
    });

    it('returns undefined if the module does not exist', function () {
      const name = 'some name',
        path = 'some path';

      req.resolve.throws(new Error('Cannot find module'));
      lib.getComponentPath.returns(path);

      expect(fn(name)).to.equal(undefined);
    });

    it('handles model.js path', function () {
      const name = 'some name',
        path = 'some path',
        result = 'some result';

      lib.getComponentPath.returns(path);
      req.resolve.withArgs(path + '/model').returns(path + '/model');
      req.withArgs(path + '/model').returns(result);

      expect(fn(name)).to.equal(result);
    });

    it('handles renderer model.js path', function () {
      const name = 'some name',
        path = 'some path',
        prefix = 'foobar',
        result = 'some result';

      lib.getComponentPath.returns(path);
      req.resolve.withArgs(`${path}/${prefix}.model`).returns(`${path}/${prefix}.model`);
      req.withArgs(`${path}/${prefix}.model`).returns(result);

      expect(fn(name, prefix)).to.equal(result);
    });

    it('returns false if the prefix is html', function () {
      const name = 'some name',
        prefix = 'html';

      expect(fn(name, prefix)).to.be.false;
      sinon.assert.notCalled(lib.getComponentPath);
    });
  });

  describe('getComponentPackage', function () {
    const fn = lib[this.title];

    beforeEach(function () {
      sandbox.stub(lib, 'getComponentPath');
    });

    it('handles missing name', function () {
      expect(fn()).to.equal();
    });

    it('handles bad name', function () {
      const name = 'some name';

      expect(fn(name)).to.equal();
    });

    it('handles bad path', function () {
      const name = 'some name';

      lib.getComponentPath.returns(null);

      expect(fn(name)).to.equal(null);
    });

    it('handles index.js path', function () {
      const name = 'some name',
        path = 'some path',
        result = [];

      lib.getComponentPath.returns(path);
      req.resolve.withArgs(path + '/package.json').returns(path + '/package.json');
      req.withArgs(path + '/package.json').returns(result);

      expect(fn(name)).to.equal(result);
    });
  });

  describe('readFilePromise', function () {
    const fn = lib[this.title];

    it('returns file contents', function () {
      const result = 'result',
        name = 'article.css';

      sandbox.stub(fs, 'readFile').callsFake(function (path, options, callback) {
        return callback(null, result);
      });

      fn(name).then(function (fileResult) {
        expect(fileResult).to.equal(result);
      });
    });

    it('throws error', function () {
      sandbox.stub(fs, 'readFile').callsFake(function (path, x, callback) {
        return callback(new Error(), '');
      });

      fn('.').catch(function (result) {
        expect(result).to.equal('');
      });
    });
  });
});
