'use strict';

const _assign = require('lodash/assign'),
  { uriToUrl } = require('./services/references'),
  files = require('./files');

/**
 * Add site data to locals for each site
 * @param {Object} site
 * @returns {Function}
 */
function addSiteData(site) {
  return (req, res, next) => {
    res.locals.url = uriToUrl(req.hostname + req.originalUrl, site.protocol, site.port);
    res.locals.site = site;

    next();
  };
}

/**
 * Adds query params to locals
 * @param {Object} req
 * @param {Object} res
 * @param {Function} next
 */
function addQueryParams(req, res, next) {
  _assign(res.locals, req.params, req.query);
  next();
}

/**
 * Adds available site routes to locals
 * @param {express.Router} router
 * @returns {Function}
 */
function addAvailableRoutes(router) {
  return (req, res, next) => {
    const routes = router.stack
      .filter((r) => r.route && r.route.path) // grab only the defined routes (not api stuff)
      .map((r) => r.route.path); // pull out their paths

    res.locals.routes = routes; // and add them to the locals
    next();
  };
}

/**
 * Adds available components to locals
 * @param {Object} req
 * @param {Object} res
 * @param {Function} next
 */
function addAvailableComponents(req, res, next) {
  res.locals.components = files.getComponents();
  next();
}

/**
 * Adds current user to locals
 * @param {Object} req
 * @param {Object} res
 * @param {Function} next
 */
function addUser(req, res, next) {
  res.locals.user = req.user;
  next();
}

function getDefaultLocals(site) {
  return {
    site,
    url: '',
    edit: false,
    query: {},
    params: {}
  };
}

module.exports.addSiteData = addSiteData;
module.exports.addQueryParams = addQueryParams;
module.exports.addAvailableRoutes = addAvailableRoutes;
module.exports.addAvailableComponents = addAvailableComponents;
module.exports.addUser = addUser;
module.exports.getDefaultLocals = getDefaultLocals;
