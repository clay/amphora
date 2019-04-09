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
  let sandbox, plugin, pluginWithMetadata, fakeLog;

  beforeEach(function () {
    sandbox = sinon.sandbox.create();

    plugin = sandbox.stub();
    pluginWithMetadata = { init: sandbox.stub().returns(true) };
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
      lib.plugins = [plugin, pluginWithMetadata];
      plugin.returns(true);

      return fn()
        .then(() => {
          sinon.assert.calledOnce(plugin);
          sinon.assert.calledOnce(pluginWithMetadata.init);
        });
    });

    it('logs a warning if a plugin is not a function or does not have an init function', function () {
      lib.plugins = [false];
      plugin.returns(true);

      return fn()
        .then(() => {
          sinon.assert.calledWith(fakeLog, 'warn', 'Plugin is not a function or does not have an init function');
        });
    });
  });

  describe('getWhitelistFromPlugins', function () {
    it('returns an array of all the plugin\'s whitelist combined', function () {
      const plugins = [plugin, pluginWithMetadata];

      pluginWithMetadata.whitelist = ['/_test'];
      plugin.returns(true);

      expect(lib.getWhitelistFromPlugins(plugins)).to.eql(['/_test']);
    });

    it('returns an empty array if no plugins have a whitelist', function () {
      const plugins = [plugin];

      plugin.returns(true);
      lib.getWhitelistFromPlugins(plugins);

      expect(lib.getWhitelistFromPlugins(plugins)).to.be.empty;
    });
  });

  describe('skipAuth', function () {
    it('sets skipAuth to true if the request url is in the whitelist', function () {
      const req = { headers: {}, url: '/_test' };

      lib.whitelist = ['/_test'];
      lib.skipAuth(req, {}, sandbox.stub());

      expect(req.skipAuth).to.be.true;
    });

    it('calls next', function (done) {
      lib.skipAuth({ url: '' }, {}, done);
    });
  });
});
