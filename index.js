// this will set up things
'use strict';

var _ = require('lodash'),
  app = require('express')(),
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
 * @returns {Promise}
 */
function bootstrapComponents() {
  var components = files.getComponents();

  return bluebird.all(_.map(components, function (component) {
    var componentPath = files.getComponentPath(component);
    return bootstrap(componentPath).catch(function () {
      logLess('No bootstrap found for ' + component);
    });
  }));
}

/**
 * @returns {Promise}
 */
function bootstrapSites() {
  var sites = siteService.sites();

  return bluebird.all(_.map(sites, function (site) {
    return bootstrap(site.dirPath, {uriPrefix: site.host + site.path}).catch(function () {
      logLess('No bootstrap found for ' + site.slug);
    });
  }));
}

/**
 * @returns {Promise}
 */
module.exports = function () {
  var router = routes(app);

  //look for bootstraps in components
  return bootstrapComponents().then(function () {
    return bootstrapSites();
  }).then(function () {
    return bootstrapCurrentProject();
  }).then(function () {
    return router;
  });
};

//services exposed to outside
module.exports.db = require('./lib/services/db');
module.exports.components = require('./lib/services/components');
module.exports.pages = require('./lib/services/pages');
