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
 * @param {Object[]} middleware
 * @return {Router}
 */
function attachPlainRoute(router, { path }, middleware) {
  const handlers = middleware.concat(render);

  return router.get(path, handlers);
}

/**
 * Attaches a route with redirect to the router.
 * @param {Router} router
 * @param {Object} route
 * @param {String} route.path
 * @param {String} route.redirect
 * @param {Object} site
 * @param {Object[]} middleware
 * @return {Router}
 */
function attachRedirect(router, { path, redirect }, site, middleware) {
  function redirectFn(req, res) {
    res.redirect(301, normalizeRedirectPath(redirect, site));
  }
  const handlers = middleware.concat(redirectFn);

  return router.get(path, handlers);
}

/**
 * Attaches a dynamic route to the router.
 * @param {Router} router
 * @param {Object} route
 * @param {String} route.path
 * @param {String} route.dynamicPage
 * @param {Object[]} middleware
 * @return {Router}
 */
function attachDynamicRoute(router, { path, dynamicPage }, middleware) {
  const handlers = middleware.concat(render.renderDynamicRoute(dynamicPage));

  return router.get(path, handlers);
}

/**
 * Parses site route config object.
 * @param {Router} router
 * @param {Object} routeObj - Route config
 * @param {Object} site
 * @return {Router}
 */
function parseHandler(router, routeObj, site) {
  const { redirect, dynamicPage, path } = routeObj,
    middleware = routeObj.middleware || [];

  if (!validPath(path, site)) {
    return;
  }

  if (redirect) {
    return attachRedirect(router, routeObj, site, middleware);
  } else if (dynamicPage) {
    return attachDynamicRoute(router, routeObj, middleware); // Pass in the page ID
  } else {
    return attachPlainRoute(router, routeObj, middleware);
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
