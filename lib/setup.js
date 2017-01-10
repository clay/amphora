'use strict';

const bluebird = require('bluebird'),
  express = require('express'),
  routes = require('./routes'),
  bootstrap = require('./bootstrap'),
  htmlComposer = require('./html-composer'),
  search = require('./services/search'),
  searchRoute = require('./elastic/routes');

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
  let app, engines, providers, router, sessionStore, searchConfig;

  options = options || {};
  app = options.app || express(); // use new express app if not passed in
  engines = options.engines; // will be undefined if not passed in
  providers = options.providers || [];
  sessionStore = options.sessionStore;
  searchConfig = options.search || {}; // Config object to pass to the search setup

  // init the router
  router = routes(app, providers, sessionStore);

  // if engines were passed in, send them to the composer
  if (engines) {
    htmlComposer.addEngines(engines);
  }

  return bootstrap() // look for bootstraps in components
    .then(search.setup(searchConfig)) // setup search
    .then(searchRoute(router))  // search route needs to be set up at base url
    .return(router);
};
