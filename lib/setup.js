'use strict';

const bluebird = require('bluebird'),
  express = require('express'),
  routes = require('./routes'),
  bootstrap = require('./bootstrap'),
  render = require('./render'),
  amphoraPlugins = require('./plugins'),
  log = require('./services/log').setup({
    file: __filename,
    action: 'setup'
  });

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
module.exports = function (options = {}) {
  let {
      app = express(),
      providers = [],
      sessionStore,
      renderers,
      plugins = [],
      env = [],
      cacheControl = {}
    } = options, router;
  // TODO: DOCUMENT RENDERERS, ENV, PLUGINS, AND CACHE CONTROL

  // Init plugins
  if (plugins.length) {
    log('trace', 'Registering plugins', {
      pluginCount: plugins.length
    });
    amphoraPlugins.registerPlugins(plugins);
  }

  // init the router
  router = routes(app, providers, sessionStore, cacheControl);

  // if engines were passed in, send them to the renderer
  if (renderers) {
    render.registerRenderers(renderers);
    render.registerEnv(env);
  }

  // look for bootstraps in components
  return bootstrap().then(function () {
    return router;
  });
};
