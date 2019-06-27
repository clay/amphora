'use strict';

const _ = require('lodash'),
  filename = __filename.split('/').pop().split('.').shift(),
  lib = require('./' + filename),
  sinon = require('sinon'),
  { expect } = require('chai'),
  storage = require('../test/fixtures/mocks/storage'),
  plugins = require('./services/plugins'),
  render = require('./render'),
  bus = require('./services/bus');

describe(_.startCase(filename), function () {
  let sandbox, db, fakeLog;

  beforeEach(function () {
    sandbox = sinon.sandbox.create();
    sandbox.stub(plugins, 'registerPlugins');
    sandbox.stub(render, 'registerRenderers');
    db = storage();
    fakeLog = sandbox.stub();
    sandbox.stub(bus);
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
    return lib({ storage: db });
  });

  it('throws an error if no storage object is assigned', function () {
    expect(() => lib()).to.throw();
  });

  it('registers plugins', function () {
    const plugin = sandbox.stub(pluginMock());

    return lib({ plugins: [plugin], storage: db }).then(function () {
      sinon.assert.calledOnce(plugins.registerPlugins);
    });
  });

  it('registers renderers', function () {
    return lib({ renderers: { default: 'html', html: _.noop }, storage: db }).then(function () {
      sinon.assert.calledOnce(render.registerRenderers);
    });
  });

  it('initializes the bus if env vars are set', function () {
    process.env.CLAY_BUS_HOST = 'redis://localhost:6379';

    return lib({ storage: db }).then(() => sinon.assert.calledOnce(bus.connect));
  });

  it('logs if there is a sessionStore', function () {
    lib.setLog(fakeLog);

    return lib({ sessionStore: { foo: 'something' }, storage: db })
      .then(function () {
        sinon.assert.calledOnce(fakeLog);
      });
  });
});
