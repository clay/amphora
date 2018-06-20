'use strict';

const _ = require('lodash'),
  files = require('./files'),
  path = require('path'),
  filename = __filename.split('/').pop().split('.').shift(),
  lib = require('./bootstrap'),
  siteService = require('./services/sites'),
  expect = require('chai').expect,
  sinon = require('sinon'),
  storage = require('../test/fixtures/mocks/storage');

describe(_.startCase(filename), function () {
  let sandbox, db,
    bootstrapFake, // eslint-disable-line
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
      path: '/',
      dir: 'example2',
      prefix: 'example1.com'
    }, {
      host: 'example3.com',
      path: '/some-path',
      dir: 'example3',
      prefix: 'example1.com/some-path'
    }];
    bootstrapFake = files.getYaml(path.resolve('./test/fixtures/config/bootstrap'));
  });

  beforeEach(function () {
    sandbox = sinon.sandbox.create();
    fakeLog = sandbox.stub();

    lib.setLog(fakeLog);
    sandbox.stub(siteService);
    siteService.sites.returns(_.cloneDeep(sitesFake));
    db = storage();
    lib.setDb(db);
    // return db.clear();
  });

  afterEach(function () {
    sandbox.restore();
  });

  after(function () {
    // clean up
    // return db.clear();
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

    it('bootstraps', function () {
      files.getComponents.returns(['a', 'b', 'c']);
      files.getYaml.withArgs('example1').returns({});

      return fn();
    });

    it('hits the `then` function when bootstrapPath is run successfully', function () {
      files.getComponents.returns(['a', 'b', 'c']);
      files.getYaml.withArgs('example1').returns({});
      sandbox.stub(lib, 'bootstrapPath').returns(Promise.resolve({}));
      return fn();
    });

    it('skips running the bootstrap process if the `runBootstrap` bool is false', function () {
      return fn(false)
        .then(function () {
          sinon.assert.calledWith(fakeLog,'info', 'Skipping bootstrapping sites and components');
        });
    });
  });

  describe('bootstrapPath', function () {
    const fn = lib[this.title];

    it('missing bootstrap', function (done) {
      fn('./jfkdlsa', sitesFake[0])
        .then(done.bind(null, 'should throw'))
        .catch(function () {
          done();
        });
    });

    it('reads from bootstrap', function () {
      return fn('./test/fixtures/config/bootstrap', sitesFake[0]).then(function () {
        sinon.assert.calledOnce(db.batch);
      });
    });

    it('reads from bootstrap without bootstrap in path', function () {
      return fn('./test/fixtures/config', sitesFake[0]);
    });

    it('reads from bootstrap with extension in path', function () {
      return fn('./test/fixtures/config/bootstrap.yaml', sitesFake[0]);
    });
  });
});
