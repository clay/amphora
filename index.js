// this will set up things
'use strict';

var _ = require('lodash'),
  express = require('express'),
  siteService = require('./lib/sites'),
  files = require('./lib/files'),
  routes = require('./lib/routes'),
  bootstrap = require('./lib/bootstrap'),
  bluebird = require('bluebird'),
  log = require('./lib/log'),
  chalk = require('chalk');

/**
 * Dims the log slightly.
 * @param {string} msg
 */
function logLess(msg) {
  log.info(chalk.dim(msg));
}

/**
 * @returns {Promise}
 */
function bootstrapCurrentProject() {
  return bootstrap('.').catch(function () {
    logLess('No bootstrap found at root of project.');
  });
}

/**
 * @param {string} [prefix]
 * @returns {Promise}
 */
function bootstrapComponents(prefix) {
  var components = files.getComponents();

  return bluebird.all(_.map(components, function (component) {
    var componentPath = files.getComponentPath(component);
    return bootstrap(componentPath, prefix).catch(function () {
      logLess('No bootstrap found for ' + component + (prefix ? ' at ' + prefix : ''));
    });
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
      return bootstrap(site.dirPath, prefix).catch(function () {
        logLess('No bootstrap found for ' + site.slug);
      });
    });
  }));
}

/**
 * @param {express.Router} [router=express()]
 * @returns {Promise}
 */
module.exports = function (router) {
  router = routes(router || express());

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
