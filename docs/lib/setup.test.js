'use strict';

const _ = require('lodash'),
  filename = __filename.split('/').pop().split('.').shift(),
  lib = require('./' + filename),
  sinon = require('sinon'),
  plugins = require('./plugins'),
  render = require('./render');

describe(_.startCase(filename), function () {
  let sandbox;

  beforeEach(function () {
    sandbox = sinon.sandbox.create();
    sandbox.stub(plugins, 'registerPlugins');
    sandbox.stub(render, 'registerRenderers');
    sandbox.stub(render, 'registerEnv');
  });

  afterEach(function () {
    sandbox.restore();
  });

  /**
   * Return a fake plugin
   * @return {Object}
   */
  function pluginMock() {
    return {
      init: _.noop,
      save: _.noop,
      delete: _.noop
    };
  }

  it('sets up', function () {
    return lib();
  });

  it('registers plugins', function () {
    const plugin = sandbox.stub(pluginMock());

    return lib({ plugins: [plugin] }).then(function () {
      sinon.assert.calledOnce(plugins.registerPlugins);
    });
  });

  it('registers renderers', function () {
    return lib({ renderers: { default: 'html', html: _.noop } }).then(function () {
      sinon.assert.calledOnce(render.registerRenderers);
    });
  });

  it('registers env vars', function () {
    return lib({ renderers: { default: 'html', html: _.noop } }).then(function () {
      sinon.assert.calledOnce(render.registerEnv);
    });
  });
});
