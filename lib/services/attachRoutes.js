'use strict';

const render = require('../render');

function attachPlainRoute(router, { path }) {
  return router.get(path, render);
}

function attachRedirect(router, { path, redirect }) {
  return router.get(path, (req, res) => {
    res.redirect(301, redirect);
  });
}

function attachDynamicRoute(router, { path, dynamicPage }) {
  return router.get(path, render.renderDynamicRoute(dynamicPage));
}

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

function attachRoutes(router, routes) {
  for (let i = 0; i < routes.length; i++) {
    parseHandler(router, routes[i]);
  }

  return router;
}

module.exports = attachRoutes;
