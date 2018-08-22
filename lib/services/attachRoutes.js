'use strict';

const render = require('../render'),
  _ = require('lodash');

let reservedRoutes,
  log = require('./logger').setup({ file: __filename });

function validPath(path, site) {
  let reservedRoute;

  if (path[0] !== '/') {
    log('warn', `Path '${path}' must begin with a slash, skipping route.`, { path, site: site.slug });
    return false;
  } else {
    reservedRoute = _.find(reservedRoutes, (route) => path.indexOf(route) === 1);

    if (reservedRoute) {
      log('warn', `Cannot attach route ${path} for site ${site.slug}. Route prefix /${reservedRoute} is reserved by Amphora.`);
      return false;
    }
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
  const { redirect, dynamicPage, path } = routeObj;

  if (!validPath(path, site)) {
    return;
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
 * @param {Array} reserved
 * @return {Router}
 */
function attachRoutes(router, routes = [], site, reserved) {
  reservedRoutes = reserved;

  routes.forEach((route) => {
    parseHandler(router, route, site);
  });

  return router;
}

module.exports = attachRoutes;
// For testing
module.exports.normalizeRedirectPath = normalizeRedirectPath;
module.exports.setLog = mock => log = mock;
