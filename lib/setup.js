'use strict';

const bluebird = require('bluebird'),
  express = require('express'),
  routes = require('./routes'),
  internalBootstrap = require('./bootstrap'),
  render = require('./render'),
  amphoraPlugins = require('./plugins'),
  db = require('./services/db'),
  bus = require('./services/bus');

bluebird.config({
  longStackTraces: true
});

/**
 * optionally pass in an express app, templating engines, and/or providers
 * note: if no providers are passed in, amphora doesn't protect routes
 * @param {Object}  [options]
 * @param {Array}   [options.providers]
 * @param {Object}  [options.app]
 * @param {Object}  [options.sessionStore]
 * @param {Object}  [options.renderers]
 * @param {Array}   [options.plugins]
 * @param {Array}   [options.env]
 * @param {Boolean} [options.bootstrap]
 * @param {Object}  [options.cacheControl]
 * @returns {Promise}
 */
module.exports = function (options = {}) {
  let {
      app = express(),
      providers = [],
      sessionStore,
      renderers,
      plugins = [],
      cacheControl = {},
      bootstrap = true,
      storage = false
    } = options, router;

  if (!storage) {
    throw new Error('A database integration was not supplied');
  }

  // Init plugins
  if (plugins.length) {
    amphoraPlugins.registerPlugins(plugins);
  }

  if (process.env.REDIS_BUS_HOST) {
    bus.connect();
  }

  // init the router
  router = routes(app, providers, sessionStore, cacheControl);

  // if engines were passed in, send them to the renderer
  if (renderers) {
    render.registerRenderers(renderers);
  }

  // Make sure the storage module is run, then bootstrap
  // all the default data and finally return the router
  return storage.setup()
    .then(() => db.registerStorage(storage))
    .then(() => internalBootstrap(bootstrap))
    .then(() => router);
};
