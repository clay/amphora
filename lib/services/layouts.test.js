'use strict';

const _ = require('lodash'),
  filename = __filename.split('/').pop().split('.').shift(),
  lib = require('./' + filename),
  sinon = require('sinon'),
  files = require('../files'),
  siteService = require('./sites'),
  composer = require('./composer'),
  models = require('./models'),
  dbOps = require('./db-operations'),
  meta = require('./metadata'),
  bus = require('./bus'),
  expect = require('chai').expect;

describe(_.startCase(filename), function () {
  let sandbox;

  beforeEach(function () {
    sandbox = sinon.sandbox.create();

    sandbox.stub(composer, 'resolveComponentReferences');
    sandbox.stub(siteService);
    sandbox.stub(files, 'getLayoutModules');
    sandbox.stub(models, 'put');
    sandbox.stub(models, 'get');
    sandbox.stub(meta, 'createLayout');
    sandbox.stub(meta, 'publishLayout');
    sandbox.stub(bus, 'publish');
  });

  afterEach(function () {
    sandbox.restore();
  });

  describe('put', function () {
    const fn = lib.testPut;

    it('will call the `models.put` service if a model is found for a layout', function () {
      files.getLayoutModules.returns({ save: _.noop });
      fn('domain.com/_layouts/foo/instances/bar', {}, {});
      sinon.assert.calledOnce(models.put);
    });

    it('will not call the `models.put` service if a model is found for a layout', function () {
      var returnedOps;

      files.getLayoutModules.returns({});
      returnedOps = fn('domain.com/_layouts/foo/instances/bar', {}, {});
      sinon.assert.notCalled(models.put);
      expect(returnedOps).to.eql([{ type: 'put', key: 'domain.com/_layouts/foo/instances/bar', value: '{}' }]);
    });
  });

  describe('get', function () {
    const fn = lib[this.title];

    it('will call the `models.get` service', function () {
      files.getLayoutModules.returns({ render: _.noop });
      fn('domain.com/_layouts/foo/instances/bar', {});
      sinon.assert.calledOnce(models.get);
    });

    it('will call the `models.get` with the render model if one exists', function () {
      files.getLayoutModules.returns({ render: _.noop });
      fn('domain.com/_layouts/foo/instances/bar', { extension: 'foo' });
      sinon.assert.calledOnce(models.get);
    });
  });

  describe('post', function () {
    const fn = lib[this.title];

    it('it will create a cascading put for the component', function () {
      const ref = 'domain.com/_layouts/foo/instances';

      sandbox.stub(dbOps, 'cascadingPut').returns(() => Promise.resolve({}));
      meta.createLayout.returns(Promise.resolve());
      return fn(ref, {}, 'locals')
        .then(result => {
          sinon.assert.calledOnce(dbOps.cascadingPut);
          sinon.assert.calledOnce(bus.publish);
          sinon.assert.calledOnce(meta.createLayout);
          expect(result._ref).to.match(/domain.com\/_layouts\/foo\/instances/);
        });
    });
  });

  describe('publish', function () {
    const fn = lib[this.title],
      ref = 'domain.com/_layouts/foo/instances/bar';

    it('calls get, compose and saves data when publishing with no data', function () {
      composer.resolveComponentReferences.returns(Promise.resolve());
      sandbox.stub(dbOps, 'cascadingPut').returns(() => Promise.resolve({}));
      models.get.returns(Promise.resolve());
      meta.publishLayout.returns(Promise.resolve());

      return fn(ref, undefined, {})
        .then(() => {
          sinon.assert.calledOnce(models.get);
          sinon.assert.calledOnce(composer.resolveComponentReferences);
          sinon.assert.calledOnce(dbOps.cascadingPut);
          sinon.assert.calledOnce(meta.publishLayout);
          sinon.assert.calledOnce(bus.publish);
        });
    });

    it('just puts the data to the db when it is defined', function () {
      sandbox.stub(dbOps, 'cascadingPut').returns(() => Promise.resolve({}));
      meta.publishLayout.returns(Promise.resolve());
      return fn(ref, { foo: 'bar' }, {})
        .then(() => {
          sinon.assert.calledOnce(dbOps.cascadingPut);
          sinon.assert.calledOnce(meta.publishLayout);
          sinon.assert.calledOnce(bus.publish);
        });
    });
  });
});
