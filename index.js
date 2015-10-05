'use strict';

var express = require('express'),
  siteService = require('./lib/services/sites'),
  routes = require('./lib/routes'),
  bootstrap = require('./lib/bootstrap'),
  composer = require('./lib/composer');

/**
 * optionally pass in an express app and/or templating engines
 * @param {object} [options]
 * @param {object} [options.app]
 * @param {object} [options.engines]
 * @returns {Promise}
 */
module.exports = function (options) {
  var app, engines, router;

  options = options || {};
  app = options.app || express(); // use new express app if not passed in
  engines = options.engines; // will be undefined if not passed in

  // init the router
  router = routes(app);

  // if engines were passed in, send them to the composer
  if (engines) {
    composer.addEngines(engines);
  }

  //look for bootstraps in components
  return bootstrap().then(function () {
    return router;
  });
};

//services exposed to outside
module.exports.db = require('./lib/services/db');
module.exports.components = require('./lib/services/components');
module.exports.pages = require('./lib/services/pages');
module.exports.sites = siteService;
