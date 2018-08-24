'use strict';

const _ = require('lodash'),
  filename = __filename.split('/').pop().split('.').shift(),
  lib = require('./' + filename),
  sinon = require('sinon'),
  expect = require('chai').expect,
  storage = require('../../test/fixtures/mocks/storage'),
  upgrade = require('./upgrade'),
  timer = require('../timer');

describe(_.startCase(filename), function () {
  const timeoutConstant = 100;
  let sandbox, db, fakeLog, savedTimeoutConstant;

  beforeEach(function () {
    sandbox = sinon.sandbox.create();

    sandbox.stub(upgrade, 'init');
    sandbox.stub(timer);

    fakeLog = sandbox.stub();
    db = storage();
    lib.setLog(fakeLog);
    lib.setDb(db);
    savedTimeoutConstant = lib.getTimeoutConstant();
    lib.setTimeoutConstant(timeoutConstant);
  });

  afterEach(function () {
    sandbox.restore();
    lib.setTimeoutConstant(savedTimeoutConstant);
  });

  describe('get', function () {
    const fn = lib[this.title];

    it('skips the model if executeRenderer is not true', function () {
      db.get.returns(Promise.resolve({}));
      upgrade.init.returns(Promise.resolve({}));

      return fn(_.noop, undefined, false, 'someuri', {})
        .then(() => {
          sinon.assert.calledOnce(db.get);
          sinon.assert.calledOnce(upgrade.init);
        });
    });

    it('errors if no object is returned', function () {
      db.get.returns(Promise.resolve(undefined));
      upgrade.init.returns(Promise.resolve(undefined));

      return fn(_.noop, undefined, false, 'someuri', {})
        .catch(() => {
          sinon.assert.calledOnce(db.get);
          sinon.assert.calledOnce(upgrade.init);
        });
    });

    it('runs the renderer model if one is defined', function () {
      const rendererModel = sandbox.stub().returns(Promise.resolve({}));

      db.get.returns(Promise.resolve({}));
      upgrade.init.returns(Promise.resolve({}));
      return fn(_.noop, rendererModel, false, 'someuri', {})
        .then(() => {
          sinon.assert.calledWith(rendererModel, 'someuri', {}, {});
          sinon.assert.calledOnce(db.get);
          sinon.assert.calledOnce(upgrade.init);
        });
    });

    it('runs the render function of model if one is defined', function () {
      const render = sandbox.stub().returns(Promise.resolve({}));

      db.get.returns(Promise.resolve({}));
      upgrade.init.returns(Promise.resolve({}));
      return fn({ render }, undefined, true, 'someuri', {})
        .then(() => {
          sinon.assert.calledWith(render, 'someuri', {}, {});
          sinon.assert.calledOnce(db.get);
          sinon.assert.calledOnce(upgrade.init);
        });
    });

    it('errors if the render model does not return an object', function () {
      const render = sandbox.stub().returns(Promise.resolve(undefined));

      db.get.returns(Promise.resolve({}));
      upgrade.init.returns(Promise.resolve({}));
      return fn({ render }, undefined, true, 'someuri', {})
        .catch(() => {
          sinon.assert.calledWith(render, 'someuri', {}, {});
          sinon.assert.calledOnce(db.get);
          sinon.assert.calledOnce(upgrade.init);
        });
    });

    it('logs warning for slow component', function () {
      const render = sandbox.stub().returns(Promise.resolve({}));

      db.get.returns(Promise.resolve({}));
      timer.getMillisecondsSince.returns(timeoutConstant * 3);
      upgrade.init.returns(Promise.resolve({}));

      return fn({ render }, undefined, true, 'someuri', {})
        .then(() => {
          sinon.assert.calledWith(fakeLog, 'warn', sinon.match('slow get someuri 300ms'));
        });
    });
  });

  describe('put', function () {
    const fn = lib[this.title];

    it('runs a model save function', function () {
      const save = sandbox.stub().returns({foo: true});

      return fn({ save }, 'someuri', {}, {})
        .then(resp => {
          expect(resp).to.eql({ key: 'someuri', value: '{"foo":true}', type: 'put'});
        });
    });

    it('errors if save does not return an object', function () {
      const save = sandbox.stub().returns(undefined);

      return fn({ save }, 'someuri', {}, {})
        .catch(err => {
          expect(err.message).to.equal('Unable to save someuri: Data from model.save must be an object!');
        });
    });

    it('logs warning if operation is slow', function () {
      const save = sandbox.stub().returns({foo: true});

      timer.getMillisecondsSince.returns(timeoutConstant * 7);
      return fn({ save }, 'someuri', {}, {})
        .then(() => {
          sinon.assert.calledWith(fakeLog, 'warn', 'slow put someuri 700ms');
        });
    });
  });
});
