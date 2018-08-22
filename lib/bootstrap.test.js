'use strict';

const _ = require('lodash'),
  fs = require('fs'),
  files = require('./files'),
  path = require('path'),
  filename = __filename.split('/').pop().split('.').shift(),
  lib = require('./bootstrap'),
  db = require('./services/db'),
  siteService = require('./services/sites'),
  sinon = require('sinon'),
  { expect } = require('chai');

describe(_.startCase(filename), function () {
  let sandbox,
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
    badYaml = fs.readFileSync(path.resolve('./test/fixtures/config/bad-bootstrap.yml'));
  });

  beforeEach(function () {
    sandbox = sinon.sandbox.create();
    fakeLog = sandbox.stub();

    lib.setLog(fakeLog);
    sandbox.stub(siteService);
    siteService.sites.returns(_.cloneDeep(sitesFake));
    sandbox.stub(files, 'readFilePromise');
    sandbox.stub(files, 'fileExists');

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
    });

    // it('skips running the bootstrap process if the `runBootstrap` bool is false', function () {
    //   return fn(false)
    //     .then(() => {
    //       sinon.assert.calledWith(fakeLog,'info', 'Skipping bootstrapping sites and components');
    //     });
    // });

    // it('bootstraps data for multiple sites', function () {
    //   files.getComponents.returns(['a']);
    //   files.isDirectory.returns(true);
    //   files.fileExists.onFirstCall().returns(false);
    //   files.fileExists.onSecondCall().returns(true);
    //   files.readFilePromise.onCall(0).returns(Promise.resolve(bootstrapFake));

    //   return fn()
    //     .catch(e => expect(e.message).to.match(/^Bootstrap contains undefined data/));
    // });

    it('handles errors', function () {
      files.getComponents.returns(['a']);
      files.isDirectory.returns(true);
      files.fileExists.returns(true);
      // files.getYaml.returns(Promise.resolve(badYaml));

      return fn()
        .then(() => {
          sinon.assert.called(fakeLog);
        });
    });
  });

  describe('readYamlOrYml', function () {
    const fn = lib[this.title];

    it('logs when an empty directory exists and does not contain a bootstrap file', function () {
      files.fileExists.returns(false);

      return fn('path/to/some/cmptorlayout/bootstrap')
        .then(() => {
          sinon.assert.calledOnce(fakeLog);
          sinon.assert.calledWith(fakeLog, 'warn', 'Could not find bootstrap.(yml|yaml) at cmptorlayout, component will not be bootstrapped');
        });
    });
  });
});
