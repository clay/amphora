'use strict';

const _ = require('lodash'),
  filename = __filename.split('/').pop().split('.').shift(),
  lib = require('./' + filename),
  sinon = require('sinon'),
  amphoraFs = require('amphora-fs'),
  files = require('../files'),
  siteService = require('./sites'),
  db = require('./db'),
  models = require('./models'),
  timer = require('../timer'),
  bluebird = require('bluebird'),
  upgrade = require('./upgrade'),
  schema = require('../schema'),
  plugins = require('../plugins'),
  expect = require('chai').expect;

describe(_.startCase(filename), function () {
  let sandbox;

  beforeEach(function () {
    sandbox = sinon.sandbox.create();

    sandbox.stub(db);
    sandbox.stub(siteService);
    sandbox.stub(files);
    sandbox.stub(amphoraFs);
    sandbox.stub(timer);
    sandbox.stub(upgrade);
    sandbox.stub(schema);
    sandbox.stub(plugins);
    sandbox.stub(models, 'get');

    lib.getSchema.cache = new _.memoize.Cache();
  });

  afterEach(function () {
    sandbox.restore();
  });

  describe('del', function () {
    const fn = lib[this.title];

    it('deletes', function () {
      models.get.returns(bluebird.resolve({}));
      db.del.returns(bluebird.resolve());
      amphoraFs.getComponentModule.withArgs('whatever').returns(null);
      return fn('domain.com/path/_components/whatever');
    });

    it('deletes using component module', function () {
      models.get.returns(bluebird.resolve({}));
      amphoraFs.getComponentModule.returns({del: _.constant(bluebird.resolve())});
      return fn('domain.com/path/_components/whatever');
    });

    it('deletes using component module gives locals', function () {
      const ref = 'domain.com/path/_components/whatever',
        locals = {},
        delSpy = sandbox.spy(_.constant(bluebird.resolve()));

      models.get.returns(bluebird.resolve({}));
      amphoraFs.getComponentModule.returns({del: delSpy});
      return fn(ref, locals).then(function () {
        sinon.assert.called(amphoraFs.getComponentModule);
        sinon.assert.calledWith(delSpy, ref, locals);
      });
    });
  });

  describe('put', function () {
    const fn = lib[this.title];

    it('throw exception if model does not return object', function (done) {
      const ref = 'a',
        data = {},
        putSpy = sinon.stub();

      putSpy.returns('abc');
      amphoraFs.getComponentModule.returns({save: putSpy});
      db.batch.returns(bluebird.resolve());

      fn(ref, data).then(done).catch(function (error) {
        expect(error.message).to.equal('Unable to save a: Data from model.save must be an object!');
        done();
      });
    });

    it('puts', function () {
      const ref = 'a',
        data = {};

      db.batch.returns(bluebird.resolve());

      return fn(ref, data).then(function () {
        expect(db.batch.getCall(0).args[0]).to.deep.contain.members([{ key: 'a', type: 'put', value: '{}' }]);
      });
    });

    it('returns original object if successful', function () {
      const ref = 'a',
        data = {};

      db.batch.returns(bluebird.resolve());

      return fn(ref, data).then(function (result) {
        expect(result).to.deep.equal({});
      });
    });

    it('cascades', function () {
      const ref = 'a',
        data = {a: 'b', c: {_ref:'d', e: 'f'}};

      db.batch.returns(bluebird.resolve());

      return fn(ref, data).then(function () {
        const ops = db.batch.getCall(0).args[0];

        expect(ops).to.deep.contain.members([
          { key: 'd', type: 'put', value: JSON.stringify({e: 'f'}) },
          { key: 'a', type: 'put', value: JSON.stringify({a: 'b', c: { _ref: 'd'}}) }
        ]);
      });
    });

    it('cascades with component models gives locals', function () {
      const ref = 'a',
        locals = {},
        data = {a: 'b', c: {_ref:'d', e: 'f'}},
        putSpy = sinon.stub();

      amphoraFs.getComponentModule.returns({save: putSpy});
      db.batch.returns(bluebird.resolve());
      putSpy.withArgs('a', sinon.match.object).returns({h: 'i'});
      putSpy.withArgs('d', sinon.match.object).returns({k: 'l'});

      return fn(ref, data, locals).then(function () {
        sinon.assert.called(amphoraFs.getComponentModule);
        sinon.assert.calledWith(putSpy.firstCall, 'd', { e: 'f' }, locals);
        sinon.assert.calledWith(putSpy.secondCall, 'a', { a: 'b', c: { _ref: 'd' } }, locals);
      });
    });

    it('returns basic root object if successful even if cascading', function () {
      const ref = 'a',
        data = {a: 'b', c: {_ref:'d', e: 'f'}};

      db.batch.returns(bluebird.resolve([]));

      return fn(ref, data).then(function (result) {
        expect(result).to.deep.equal({ a: 'b', c: { _ref: 'd' } });
      });
    });

    it('puts with default behavior if componenthooks is explicitly false', function () {
      const ref = 'a',
        data = {},
        putSpy = sinon.stub().returns(Promise.resolve({}));

      db.batch.returns(bluebird.resolve());
      amphoraFs.getComponentModule.returns({save: putSpy});
      return fn(ref, data, { componenthooks: 'false' }).then(() => {
        expect(db.batch.getCall(0).args[0]).to.deep.contain.members([{ key: 'a', type: 'put', value: '{}' }]);
      });
    });
  });

  describe('publish', function () {
    const fn = lib[this.title];

    it('publishes if given data', function () {
      const uri = 'some uri',
        data = {a: 'b'};

      db.batch.returns(bluebird.resolve());
      schema.getSchema.returns(Promise.reject());

      return fn(uri, data).then(function (result) {
        expect(result).to.deep.equal(data);
        sinon.assert.calledWith(db.batch, [{ type: 'put', key: 'some uri', value: JSON.stringify(data) }]);
      });
    });

    it('publishes latest composed data if not given data', function () {
      const uri = 'some uri',
        deepUri = 'd/_components/e/instances/f',
        data = {a: 'b', c: {_ref: deepUri}},
        deepData = {g: 'h'};

      db.batch.returns(bluebird.resolve());
      models.get.onFirstCall().returns(bluebird.resolve(data));
      models.get.onSecondCall().returns(bluebird.resolve(deepData));
      schema.getSchema.returns(Promise.resolve({}));

      return fn(uri).then(function (result) {
        expect(result).to.deep.equal(data);
        sinon.assert.calledWith(db.batch, [
          { key: 'd/_components/e/instances/f', type: 'put', value: '{"g":"h"}' },
          { key: 'some uri', type: 'put', value: '{"a":"b","c":{"_ref":"d/_components/e/instances/f"}}'}
        ]);
      });
    });

    it('publishes latest composed data if not given data, but not base components', function () {
      const uri = 'some uri',
        deepUri = 'd/_components/e',
        data = {a: 'b', c: {_ref: deepUri}},
        deepData = {g: 'h'};

      db.batch.returns(bluebird.resolve());
      models.get.onFirstCall().returns(bluebird.resolve(data));
      models.get.onSecondCall().returns(bluebird.resolve(deepData));
      schema.getSchema.returns(Promise.resolve({ _layout: false }));

      return fn(uri).then(function (result) {
        expect(result).to.deep.equal(data);
        sinon.assert.calledWith(db.batch, [
          { key: 'some uri', type: 'put', value: '{"a":"b","c":{"_ref":"d/_components/e"}}'}
        ]);
      });
    });

    it('executes plugin hook if publishing a layout', function () {
      const uri = 'some uri',
        data = {a: 'b'};

      db.batch.returns(bluebird.resolve());
      schema.getSchema.returns(Promise.resolve({ _layout: true }));

      return fn(uri, data, { user: { name: 'someone' }}).then(function () {
        expect(plugins.executeHook.called).to.equal(true);
        expect(plugins.executeHook.getCall(0).args[0]).to.equal('publishLayout');
      });
    });

    it('executes plugin hook if publishing a layout without data', function () {
      const uri = 'some uri',
        deepUri = 'd/_components/e/instances/f',
        data = {a: 'b', c: {_ref: deepUri}},
        deepData = {g: 'h'};

      db.batch.returns(bluebird.resolve());
      models.get.onFirstCall().returns(bluebird.resolve(data));
      models.get.onSecondCall().returns(bluebird.resolve(deepData));
      schema.getSchema.returns(Promise.resolve({ _layout: true }));

      return fn(uri, null, { user: { name: 'someone' }}).then(function () {
        expect(plugins.executeHook.called).to.equal(true);
        expect(plugins.executeHook.getCall(0).args[0]).to.equal('publishLayout');
      });
    });
  });

  describe('get', function () {
    const fn = lib[this.title];

    it('will call the `models.get` service', function () {
      amphoraFs.getComponentModule.returns({ render: _.noop });
      fn('domain.com/_components/foo/instances/bar', {});
      sinon.assert.calledOnce(models.get);
    });

    it('will call the `models.get` with the render model if one exists', function () {
      amphoraFs.getComponentModule.returns({ render: _.noop });
      fn('domain.com/_components/foo/instances/bar', { extension: 'foo' });
      sinon.assert.calledOnce(models.get);
    });
  });
});
