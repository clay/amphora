'use strict';

const _ = require('lodash'),
  filename = __filename.split('/').pop().split('.').shift(),
  lib = require('./' + filename),
  sinon = require('sinon'),
  files = require('../files'),
  siteService = require('./sites'),
  composer = require('./composer'),
  models = require('./models'),
  expect = require('chai').expect;

describe(_.startCase(filename), function () {
  let sandbox, plugin, fakeLog;

  beforeEach(function () {
    sandbox = sinon.sandbox.create();

    plugin = sandbox.stub();
    fakeLog = sandbox.stub();
    lib.setLog(fakeLog);
    sandbox.stub(composer, 'resolveComponentReferences');
    sandbox.stub(siteService);
    sandbox.stub(files, 'getComponentModule');
    sandbox.stub(models, 'put');
    sandbox.stub(models, 'get');
  });

  afterEach(function () {
    sandbox.restore();
  });

  describe('registerPlugins', function () {
    const fn = lib[this.title];

    it('registers plugins', function () {
      fn([_.noop]);
      expect(lib.plugins).to.eql([_.noop]);
    });
  });

  describe('initPlugins', function () {
    const fn = lib[this.title];

    it('will try to invoke each plugin', function () {
      lib.plugins = [plugin];
      plugin.returns(true);

      return fn()
        .then(() => {
          sinon.assert.calledOnce(plugin);
        });
    });

    it('logs a warning if a plugin is not a function', function () {
      lib.plugins = [false];
      plugin.returns(true);

      return fn()
        .then(() => {
          sinon.assert.calledWith(fakeLog, 'warn', 'Plugin is not a function');
        });
    });
  });
});
