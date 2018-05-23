'use strict';

const _ = require('lodash'),
  filename = __filename.split('/').pop().split('.').shift(),
  lib = require('./' + filename),
  sinon = require('sinon'),
  files = require('../files'),
  siteService = require('./sites'),
  db = require('./db'),
  timer = require('../timer'),
  bluebird = require('bluebird'),
  upgrade = require('./upgrade'),
  schema = require('../schema'),
  expect = require('chai').expect;

describe(_.startCase(filename), function () {
  const timeoutConstant = 100;
  let sandbox,
    savedTimeoutConstant,
    fakeLog;

  beforeEach(function () {
    sandbox = sinon.sandbox.create();
    fakeLog = sandbox.stub();

    sandbox.stub(db);
    sandbox.stub(siteService);
    sandbox.stub(files);
    sandbox.stub(timer);
    sandbox.stub(upgrade);
    sandbox.stub(schema);

    lib.getSchema.cache = new _.memoize.Cache();

    savedTimeoutConstant = lib.getTimeoutConstant();
    lib.setTimeoutConstant(timeoutConstant);
    lib.setLog(fakeLog);
  });

  afterEach(function () {
    sandbox.restore();
    lib.setTimeoutConstant(savedTimeoutConstant);
  });

  describe('del', function () {
    const fn = lib[this.title];

    it('deletes', function () {
      db.get.returns(bluebird.resolve('{}'));
      db.del.returns(bluebird.resolve());
      files.getComponentModule.withArgs('whatever').returns(null);
      return fn('domain.com/path/_components/whatever');
    });

    it('deletes using component module', function () {
      db.get.returns(bluebird.resolve('{}'));
      files.getComponentModule.returns({del: _.constant(bluebird.resolve())});
      return fn('domain.com/path/_components/whatever');
    });

    it('deletes using component module gives locals', function () {
      const ref = 'domain.com/path/_components/whatever',
        locals = {},
        delSpy = sandbox.spy(_.constant(bluebird.resolve()));

      db.get.returns(bluebird.resolve('{}'));
      files.getComponentModule.returns({del: delSpy});
      return fn(ref, locals).then(function () {
        sinon.assert.called(files.getComponentModule);
        sinon.assert.calledWith(delSpy, ref, locals);
      });
    });
  });

  describe('put', function () {
    const fn = lib[this.title];

    it('throw exception if ops length is 0', function (done) {
      const ref = 'a',
        data = {};

      sandbox.stub(lib, 'getPutOperations').returns(bluebird.resolve([]));

      fn(ref, data).then(done).catch(function (error) {
        expect(error.message).to.equal('Component module PUT failed to create batch operations: a');
        done();
      });
    });

    it('throw exception if model does not return object', function (done) {
      const ref = 'a',
        data = {},
        putSpy = sinon.stub();

      putSpy.returns('abc');
      files.getComponentModule.returns({save: putSpy});
      db.batch.returns(bluebird.resolve());

      fn(ref, data).then(done).catch(function (error) {
        expect(error.message).to.equal('Unable to save a: Data from model.save must be an object!');
        done();
      });
    });

    it('logs warning if operation is slow', function () {
      const ref = 'a',
        data = {},
        saveSpy = sinon.stub(),
        moduleDataValue = {b: 'c'},
        moduleData = { key: 'a', type: 'put', value: JSON.stringify(moduleDataValue) };

      timer.getMillisecondsSince.returns(timeoutConstant * 7);
      saveSpy.withArgs('a', sinon.match.object).returns([moduleData]);
      files.getComponentModule.returns({save: saveSpy});
      db.batch.returns(bluebird.resolve());

      return fn(ref, data, { componenthooks: 'true' }).then(function () {
        sinon.assert.calledWith(fakeLog, 'warn', 'slow put a 700ms');
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

      files.getComponentModule.returns({save: putSpy});
      db.batch.returns(bluebird.resolve());
      putSpy.withArgs('a', sinon.match.object).returns({h: 'i'});
      putSpy.withArgs('d', sinon.match.object).returns({k: 'l'});

      return fn(ref, data, locals).then(function () {
        sinon.assert.called(files.getComponentModule);
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
        putSpy = sinon.stub();

      db.batch.returns(bluebird.resolve());
      files.getComponentModule.returns({save: putSpy});
      return fn(ref, data, { componenthooks: 'false' }).then(function () {
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
      db.get.withArgs(uri).returns(bluebird.resolve(JSON.stringify(data)));
      db.get.withArgs(deepUri).returns(bluebird.resolve(JSON.stringify(deepData)));
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
      db.get.withArgs(uri).returns(bluebird.resolve(JSON.stringify(data)));
      db.get.withArgs(deepUri).returns(bluebird.resolve(JSON.stringify(deepData)));
      schema.getSchema.returns(Promise.resolve({ _layout: false }));

      return fn(uri).then(function (result) {
        expect(result).to.deep.equal(data);
        sinon.assert.calledWith(db.batch, [
          { key: 'some uri', type: 'put', value: '{"a":"b","c":{"_ref":"d/_components/e"}}'}
        ]);
      });
    });

    it('executes publishLayout hook if publishing a layout', function () {
      const uri = 'some uri',
        data = {a: 'b'};

      db.batch.returns(bluebird.resolve());
      schema.getSchema.returns(Promise.resolve({ _layout: true }));

      return fn(uri, data).then(function (result) {
        expect(result).to.deep.equal(data);
        sinon.assert.calledWith(db.batch, [{ type: 'put', key: 'some uri', value: JSON.stringify(data) }]);
      });
    });
  });

  describe('get', function () {
    const fn = lib[this.title];

    it('gets', function () {
      db.get.returns(bluebird.resolve('{}'));
      upgrade.init.returns(bluebird.resolve('{}'));
      files.getComponentModule.withArgs('whatever').returns(null);
      return fn('domain.com/path/_components/whatever');
    });

    it('blocks get that returns non-object', function (done) {
      db.get.returns(bluebird.resolve('"a"'));
      files.getComponentModule.withArgs('whatever').returns(null);
      fn('domain.com/path/_components/whatever').then(done).catch(function () {
        done();
      });
    });

    it('gets even with bad name', function () {
      db.get.returns(bluebird.resolve('{}'));
      files.getComponentModule.withArgs('whatever').returns(null);
      return fn('bad name');
    });

    it('gets using component model', function () {
      const ref = 'domain.com/path/_components/whatever',
        renderSpy = sinon.stub();

      db.get.returns(Promise.resolve(JSON.stringify({a: 'b'})));
      upgrade.init.returns(Promise.resolve({a: 'b'}));
      renderSpy.returns({ a: 'b' });
      files.getComponentModule.returns({render: renderSpy});
      return fn(ref).then(function () {
        sinon.assert.called(files.getComponentModule);
        sinon.assert.calledWith(renderSpy, ref);
      });
    });

    it('gets using renderer model', function () {
      const ref = 'domain.com/path/_components/whatever',
        renderSpy = sinon.stub();

      db.get.returns(Promise.resolve(JSON.stringify({a: 'b'})));
      upgrade.init.returns(Promise.resolve({a: 'b'}));
      renderSpy.returns({ a: 'b' });
      files.getComponentModule.returns(renderSpy);
      return fn(ref, { extension: 'foobar' }).then(function () {
        sinon.assert.called(files.getComponentModule);
        sinon.assert.calledWith(renderSpy, ref);
      });
    });

    it('blocks component model returning non-object', function (done) {
      const ref = 'domain.com/path/_components/whatever',
        renderSpy = sinon.stub();

      db.get.returns(Promise.resolve(JSON.stringify({})));
      renderSpy.returns('abc');
      files.getComponentModule.returns({render: renderSpy});
      fn(ref).then(done).catch(function (error) {
        expect(error.message).to.equal('Component module must return object, not string: domain.com/path/_components/whatever');
        done();
      });
    });

    it('gets directly from db if componenthooks is explicitly false', function () {
      const ref = 'domain.com/path/_components/whatever',
        renderSpy = sinon.stub();

      db.get.returns(bluebird.resolve('{}'));
      files.getComponentModule.returns({render: renderSpy});
      return fn(ref, { componenthooks: 'false' }).then(function () {
        sinon.assert.called(files.getComponentModule);
        sinon.assert.calledWith(db.get, ref);
      });
    });

    it('logs warning for slow component', function () {
      const ref = 'domain.com/path/_components/whatever',
        render = sandbox.stub().returns(bluebird.resolve({}));

      db.get.returns(bluebird.resolve('{}'));
      timer.getMillisecondsSince.returns(timeoutConstant * 3);
      upgrade.init.returns(bluebird.resolve({}));
      files.getComponentModule.returns({ render });

      return fn(ref, { componenthooks: true }).then(function () {
        sinon.assert.calledWith(fakeLog, 'warn', sinon.match('slow get domain.com/path/_components/whatever 300ms'));
      });

    });

    it('gets using component model with locals', function () {
      const ref = 'domain.com/path/_components/whatever',
        locals = { componenthooks: true },
        renderSpy = sinon.stub(),
        data = {a: 'b'};

      db.get.returns(Promise.resolve(JSON.stringify(data)));
      renderSpy.returns({ _ref: ref, a: 'b' });
      files.getComponentModule.returns({render: renderSpy});
      return fn(ref, locals).then(function () {
        sinon.assert.called(files.getComponentModule);
        sinon.assert.calledWith(renderSpy, ref, data, locals);
      });
    });
  });

  describe('list', function () {
    const fn = lib[this.title];

    it('gets a list of components', function () {
      files.getComponents.returns(bluebird.resolve([]));
      return fn('domain.com/path/_components');
    });
  });
});
