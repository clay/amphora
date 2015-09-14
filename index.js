'use strict';

var _ = require('lodash'),
  express = require('express'),
  siteService = require('./lib/sites'),
  files = require('./lib/files'),
  routes = require('./lib/routes'),
  bootstrap = require('./lib/bootstrap'),
  bluebird = require('bluebird'),
  log = require('./lib/log'),
  composer = require('./lib/composer');

/**
 * @returns {Promise}
 */
function bootstrapCurrentProject() {
  return bootstrap('.').catch(function () {});
}

/**
 * @param {string} [prefix]
 * @returns {Promise}
 */
function bootstrapComponents(prefix) {
  var components = files.getComponents();

  return bluebird.all(_.map(components, function (component) {
    var componentPath = files.getComponentPath(component);
    return bootstrap(componentPath, prefix).catch(function () {});
  }));
}

/**
 * @returns {Promise}
 */
function bootstrapSites() {
  var sites = siteService.sites();

  return bluebird.all(_.map(sites, function (site) {
    var prefix = site.path.length > 1 ? site.host + site.path : site.host;

    return bootstrapComponents(prefix).then(function () {
      return bootstrap(site.dir, prefix).catch(function (ex) {
        log.error('Bootstrap error:' + ex.stack);
      });
    });
  }));
}

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
  return bootstrapSites().then(function () {
    return bootstrapCurrentProject();
  }).then(function () {
    return router;
  });
};

//services exposed to outside
module.exports.db = require('./lib/services/db');
module.exports.components = require('./lib/services/components');
module.exports.pages = require('./lib/services/pages');
