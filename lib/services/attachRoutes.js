'use strict';

const render = require('../render');

/**
 * [attachPlainRoute description]
 * @param  {[type]} router [description]
 * @param  {[type]} path   [description]
 * @return {[type]}        [description]
 */
function attachPlainRoute(router, { path }) {
  return router.get(path, render);
}

/**
 * [attachRedirect description]
 * @param  {[type]} router   [description]
 * @param  {[type]} path     [description]
 * @param  {[type]} redirect [description]
 * @return {[type]}          [description]
 */
function attachRedirect(router, { path, redirect }) {
  return router.get(path, (req, res) => {
    res.redirect(301, redirect);
  });
}

/**
 * [attachDynamicRoute description]
 * @param  {[type]} router      [description]
 * @param  {[type]} path        [description]
 * @param  {[type]} dynamicPage [description]
 * @return {[type]}             [description]
 */
function attachDynamicRoute(router, { path, dynamicPage }) {
  return router.get(path, render.renderDynamicRoute(dynamicPage));
}

/**
 * [parseHandler description]
 * @param  {[type]} router   [description]
 * @param  {[type]} routeObj [description]
 * @return {[type]}          [description]
 */
function parseHandler(router, routeObj) {
  const { redirect, dynamicPage } = routeObj;

  if (redirect) {
    return attachRedirect(router, routeObj);
  } else if (dynamicPage) {
    return attachDynamicRoute(router, routeObj); // Pass in the page ID
  } else {
    return attachPlainRoute(router, routeObj);
  }
}

/**
 * [attachRoutes description]
 * @param  {[type]} router [description]
 * @param  {[type]} routes [description]
 * @return {[type]}        [description]
 */
function attachRoutes(router, routes) {
  for (let i = 0; i < routes.length; i++) {
    parseHandler(router, routes[i]);
  }

  return router;
}

module.exports = attachRoutes;
