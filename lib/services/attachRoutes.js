'use strict';

const render = require('../render'),
  _ = require('lodash');

let reservedRoutes = [],
  log = require('./logger').setup({ file: __filename });

/**
 * Checks for validity of a route to be attached
 *
 * @param {String} path
 * @param {Object} site
 * @returns {Boolean}
 */
function validPath(path, site) {
  let reservedRoute;

  if (path[0] !== '/') {
    log('warn', `Cannot attach route '${path}' for site ${site.slug}. Path must begin with a slash.`);
    return false;
  }

  reservedRoute = _.find(reservedRoutes, (route) => path.indexOf(route) === 1);

  if (reservedRoute) {
    log('warn', `Cannot attach route '${path}' for site ${site.slug}. Route prefix /${reservedRoute} is reserved by Amphora.`);
    return false;
  }

  return true;
}

/**
 * Normalizes redirects path appending site's path to it on sub-sites' redirects.
 * @param {String} redirect
 * @param {Object} site
 * @return {String}
 */
function normalizeRedirectPath(redirect, site) {
  return site.path && !redirect.includes(site.path) ? `${site.path}${redirect}` : redirect;
}

/**
 * Attaches a plain route to the router.
 * @param {Router} router
 * @param {Object} route
 * @param {String} route.path
 * @return {Router}
 */
function attachPlainRoute(router, { path }) {
  return router.get(path, render);
}

/**
 * Attaches a route with redirect to the router.
 * @param {Router} router
 * @param {Object} route
 * @param {String} route.path
 * @param {String} route.redirect
 * @param {Object} site
 * @return {Router}
 */
function attachRedirect(router, { path, redirect }, site) {
  redirect = normalizeRedirectPath(redirect, site);

  return router.get(path, (req, res) => {
    res.redirect(301, redirect);
  });
}

/**
 * Attaches a dynamic route to the router.
 * @param {Router} router
 * @param {Object} route
 * @param {String} route.path
 * @param {String} route.dynamicPage
 * @return {Router}
 */
function attachDynamicRoute(router, { path, dynamicPage }) {
  return router.get(path, render.renderDynamicRoute(dynamicPage));
}

/**
 * Parses site route config object.
 * @param {Router} router
 * @param {Object} routeObj - Route config
 * @param {Object} site
 * @return {Router}
 */
function parseHandler(router, routeObj, site) {
  const { redirect, dynamicPage, path, middleware } = routeObj;

  if (!validPath(path, site)) {
    return;
  }

  if (middleware) {
    router.use(path, middleware);
  }

  if (redirect) {
    return attachRedirect(router, routeObj, site);
  } else if (dynamicPage) {
    return attachDynamicRoute(router, routeObj); // Pass in the page ID
  } else {
    return attachPlainRoute(router, routeObj);
  }
}

/**
 * Parses and attach all routes to the router.
 * @param {Router} router
 * @param {Object[]} routes
 * @param {Object} site
 * @param {Array} reservedRoutes
 * @return {Router}
 */
function attachRoutes(router, routes = [], site) {
  routes.forEach((route) => {
    parseHandler(router, route, site);
  });

  return router;
}

/**
 * sets the global reservedRoutes list
 *
 * @param {Array} reserved
 */
function setReservedRoutes(reserved) {
  reservedRoutes = reserved;
}

module.exports = attachRoutes;
module.exports.setReservedRoutes = setReservedRoutes;
// For testing
module.exports.normalizeRedirectPath = normalizeRedirectPath;
module.exports.setLog = mock => log = mock;
