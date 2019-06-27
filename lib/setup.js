'use strict';

const bluebird = require('bluebird'),
  express = require('express'),
  routes = require('./routes'),
  internalBootstrap = require('./bootstrap'),
  render = require('./render'),
  amphoraPlugins = require('./services/plugins'),
  db = require('./services/db'),
  bus = require('./services/bus');
let log = require('./services/logger').setup({
  file: __filename
});

bluebird.config({
  longStackTraces: process.env.AMPHORA_LONG_STACKTRACES
});

/**
 * Optionally pass in an express app, templating engines, and/or providers
 * note: if no providers are passed in, amphora doesn't protect routes.
 * @param {Object}  [options]
 * @param {Array}   [options.providers]
 * @param {Object}  [options.app]
 * @param {Object}  [options.sessionStore]
 * @param {Object}  [options.renderers]
 * @param {Array}   [options.plugins]
 * @param {Array}   [options.env]
 * @param {Boolean} [options.bootstrap]
 * @returns {Promise}
 */
module.exports = function (options = {}) {
  let {
      app = express(),
      providers = [],
      sessionStore,
      renderers,
      plugins = [],
      bootstrap = true,
      storage = false,
      eventBus = false
    } = options, router;

  if (sessionStore) {
    log('warn', 'Support for sessionStore will be dropped in Amphora v8');
  }

  if (!storage) {
    throw new Error('A database integration was not supplied');
  }

  if (process.env.CLAY_BUS_HOST) {
    bus.connect(eventBus);
  }

  // if engines were passed in, send them to the renderer
  if (renderers) {
    render.registerRenderers(renderers);
  }

  // Make sure the storage module is run, then bootstrap
  // all the default data and finally return the router
  return storage.setup()
    .then(() => db.registerStorage(storage))
    .then(() => amphoraPlugins.registerPlugins(plugins))
    .then(() => { router = routes(app, providers, sessionStore); })
    .then(() => internalBootstrap(bootstrap))
    .then(() => router);
};

// For testing
module.exports.setLog = mock => log = mock;
