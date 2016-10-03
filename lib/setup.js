'use strict';

const bluebird = require('bluebird'),
  express = require('express'),
  routes = require('./routes'),
  bootstrap = require('./bootstrap'),
  htmlComposer = require('./html-composer');

bluebird.config({
  longStackTraces: true
});

/**
 * optionally pass in an express app, templating engines, and/or providers
 * note: if no providers are passed in, amphora doesn't protect routes
 * @param {object} options
 * @param {array} [options.providers]
 * @param {object} [options.app]
 * @param {object} [options.engines]
 * @returns {Promise}
 */
module.exports = function (options) {
  let app, engines, providers, router;

  app = options.app || express(); // use new express app if not passed in
  engines = options.engines; // will be undefined if not passed in
  providers = options.providers || [];

  // init the router
  router = routes(app, providers);

  // if engines were passed in, send them to the composer
  if (engines) {
    htmlComposer.addEngines(engines);
  }

  // look for bootstraps in components
  return bootstrap().then(function () {
    return router;
  });
};
