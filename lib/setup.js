'use strict';

const bluebird = require('bluebird'),
  express = require('express'),
  routes = require('./routes'),
  bootstrap = require('./bootstrap'),
  render = require('./render'),
  plugins = require('./plugins');

bluebird.config({
  longStackTraces: true
});

/**
 * optionally pass in an express app, templating engines, and/or providers
 * note: if no providers are passed in, amphora doesn't protect routes
 * @param {object} [options]
 * @param {array} [options.providers]
 * @param {object} [options.app]
 * @param {object} [options.engines]
 * @param {object} [options.sessionStore]
 * @returns {Promise}
 */
module.exports = function (options) {
  let app, engines, providers, router, sessionStore, renderers, appPlugins

  options = options || {};
  app = options.app || express(); // use new express app if not passed in
  engines = options.engines; // will be undefined if not passed in
  providers = options.providers || [];
  sessionStore = options.sessionStore;
  renderers = options.renderers || {}; // TODO: DOCUMENT THIS
  appPlugins = options.plugins; // TODO: DOCUMENT THIS

  // Init plugins
  if (appPlugins) {
    plugins.registerPlugins(appPlugins);
  }

  // init the router
  router = routes(app, providers, sessionStore);

  // if engines were passed in, send them to the renderer
  if (renderers) {
    render.registerRenderers(renderers);
  }

  // look for bootstraps in components
  return bootstrap().then(function () {
    return router;
  });
};
