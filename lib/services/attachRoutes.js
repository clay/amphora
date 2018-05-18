'use strict';

const render = require('../render');

function attachPlainRoute(router, routeObj) {
  return router.get(routeObj.path, render);
}

function attachRedirect(router, routeObj) {
  return router.get(routeObj.path, (req, res) => {
    res.redirect(301, routeObj.redirect);
  });
}

function attachDynamicRoute(router, routeObj) {
  return router.get(routeObj.path, render.renderDynamicRoute(routeObj.pageId));
}

function parseHandler(router, routeObj) {
  const { redirect, dynamic } = routeObj;

  if (redirect) {
    // console.log(`womp`);
    return attachRedirect(router, routeObj);
  } else if (dynamic) {
    return attachDynamicRoute(router, routeObj);
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
