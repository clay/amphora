'use strict';

const bluebird = require('bluebird'),
  express = require('express'),
  routes = require('./routes'),
  internalBootstrap = require('./bootstrap'),
  render = require('./render'),
  amphoraPlugins = require('./plugins'),
  bus = require('./services/bus');

bluebird.config({
  longStackTraces: true
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
      bootstrap = true
    } = options, router; // TODO: DOCUMENT RENDERERS PLUGINS, AND CACHE CONTROL

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

  // look for bootstraps in components
  return internalBootstrap(bootstrap).then(() => router);
};
