'use strict';

const _ = require('lodash'),
  fs = require('fs'),
  files = require('./files'),
  path = require('path'),
  filename = __filename.split('/').pop().split('.').shift(),
  lib = require('./bootstrap'),
  siteService = require('./services/sites'),
  sinon = require('sinon'),
  storage = require('../test/fixtures/mocks/storage');

describe(_.startCase(filename), function () {
  let sandbox, db,
    bootstrapFake,
    badYaml,
    sitesFake,
    fakeLog;

  before(function () {
    this.timeout(400);
    sitesFake = [{
      host: 'example1.com',
      dir: 'example1',
      prefix: 'example1.com'
    }, {
      host: 'example2.com',
      dir: 'example2',
      prefix: 'example2.com'
    }, {
      host: 'example3.com',
      dir: 'example3',
      prefix: 'example3.com'
    }];
    bootstrapFake = fs.readFileSync(path.resolve('./test/fixtures/config/bootstrap.yaml'));
    badYaml = fs.readFileSync(path.resolve('./test/fixtures/config/bad.yml'));
  });

  beforeEach(function () {
    sandbox = sinon.sandbox.create();
    fakeLog = sandbox.stub();

    lib.setLog(fakeLog);
    sandbox.stub(siteService);
    siteService.sites.returns(_.cloneDeep(sitesFake));
    db = storage();
    lib.setDb(db);

    return db.clear();
  });

  afterEach(function () {
    sandbox.restore();
  });

  after(function () {
    // clean up
    return db.clear();
  });

  describe('lib', function () {
    const fn = lib;

    beforeEach(function () {
      sandbox.stub(path, 'resolve').callsFake(_.identity);
      sandbox.stub(files, 'isDirectory');
      sandbox.stub(files, 'getYaml');
      sandbox.stub(files, 'getComponents');
      sandbox.stub(files, 'getComponentPath').callsFake(_.identity);
      sandbox.stub(files, 'readFilePromise');
    });

    it('skips running the bootstrap process if the `runBootstrap` bool is false', function () {
      return fn(false)
        .then(() => {
          sinon.assert.calledWith(fakeLog,'info', 'Skipping bootstrapping sites and components');
        });
    });

    it('bootstraps data for multiple sites', function () {
      files.getComponents.returns(['a']);
      files.isDirectory.returns(true);
      files.readFilePromise.returns(Promise.resolve(bootstrapFake));
      db.put.returns(Promise.resolve());

      return fn()
        .then(() => {
          sinon.assert.called(db.put);
          sinon.assert.callCount(db.put, 66);
        });
    });

    it('bootstraps data for multiple sites', function () {
      files.getComponents.returns(['a']);
      files.isDirectory.returns(true);
      files.readFilePromise.onCall(0).returns(Promise.reject());
      files.readFilePromise.onCall(1).returns(Promise.resolve(bootstrapFake));
      db.put.returns(Promise.resolve());

      return fn()
        .catch(() => {
          sinon.assert.called(db.put);
        });
    });

    it('handles errors', function () {
      files.getComponents.returns(['a']);
      files.isDirectory.returns(true);
      files.readFilePromise.returns(Promise.resolve(badYaml));
      db.put.returns(Promise.resolve());

      return fn()
        .then(() => {
          sinon.assert.called(fakeLog);
          sinon.assert.notCalled(db.put);
        });
    });
  });
});
