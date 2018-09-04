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
  expect = require('chai').expect;

describe(_.startCase(filename), function () {
  let sandbox;

  beforeEach(function () {
    sandbox = sinon.sandbox.create();

    sandbox.stub(composer, 'resolveComponentReferences');
    sandbox.stub(siteService);
    sandbox.stub(files, 'getComponentModule');
    sandbox.stub(models, 'put');
    sandbox.stub(models, 'get');
  });

  afterEach(function () {
    sandbox.restore();
  });

  describe('put', function () {
    const fn = lib.cmptPut;

    it('will call the `models.put` service if a model is found for a component', function () {
      files.getComponentModule.returns({ save: _.noop });
      fn('domain.com/_components/foo/instances/bar', {}, {});
      sinon.assert.calledOnce(models.put);
    });

    it('will not call the `models.put` service if a model is found for a component', function () {
      var returnedOps;

      files.getComponentModule.returns({});
      returnedOps = fn('domain.com/_components/foo/instances/bar', {}, {});
      sinon.assert.notCalled(models.put);
      expect(returnedOps).to.eql([{ type: 'put', key: 'domain.com/_components/foo/instances/bar', value: '{}' }]);
    });
  });

  describe('get', function () {
    const fn = lib[this.title];

    it('will call the `models.get` service', function () {
      files.getComponentModule.returns({ render: _.noop });
      fn('domain.com/_components/foo/instances/bar', {});
      sinon.assert.calledOnce(models.get);
    });

    it('will call the `models.get` with the render model if one exists', function () {
      files.getComponentModule.returns({ render: _.noop });
      fn('domain.com/_components/foo/instances/bar', { extension: 'foo' });
      sinon.assert.calledOnce(models.get);
    });
  });

  describe('post', function () {
    const fn = lib[this.title];

    it('it will create a cascading put for the component', function () {
      const ref = 'domain.com/_components/foo/instances';

      sandbox.stub(dbOps, 'cascadingPut').returns(() => Promise.resolve({}));
      return fn(ref, {}, 'locals')
        .then(result => {
          sinon.assert.calledOnce(dbOps.cascadingPut);
          expect(result._ref).to.match(/domain.com\/_components\/foo\/instances/);
        });
    });
  });

  describe('publish', function () {
    const fn = lib[this.title],
      ref = 'domain.com/_components/foo/instances/bar';

    it('calls get, compose and saves data when publishing with no data', function () {
      composer.resolveComponentReferences.returns(Promise.resolve());
      sandbox.stub(dbOps, 'cascadingPut').returns(() => Promise.resolve({}));
      models.get.returns(Promise.resolve());

      return fn(ref, undefined, {})
        .then(() => {
          sinon.assert.calledOnce(models.get);
          sinon.assert.calledOnce(composer.resolveComponentReferences);
          sinon.assert.calledOnce(dbOps.cascadingPut);
        });
    });

    it('just puts the data to the db when it is defined', function () {
      sandbox.stub(dbOps, 'cascadingPut').returns(() => Promise.resolve({}));

      return fn(ref, { foo: 'bar' }, {})
        .then(() => {
          sinon.assert.calledOnce(dbOps.cascadingPut);
        });
    });
  });
});
