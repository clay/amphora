'use strict';

const _isArray = require('lodash/isArray');

/**
 * Enforces the value to be an array if it is not one already.
 * @param {*|*[]} value
 * @return {*[]}
 */
function enforceArray(value) {
  return !_isArray(value) ? [value] : value;
}

/**
 * Parses the middleware config and attach it to the main router.
 * @param {Router} router
 * @param {boolean} isRouter
 * @param {String} path
 * @param {Function|Router} middleware
 */
function parseMiddleware(router, { isRouter, path, middleware }) {
  const routerMethod = isRouter ? 'use' : 'get',
    middlewareArray = enforceArray(middleware),
    pathsArray = enforceArray(path);

  middlewareArray.forEach((middleware) => {
    pathsArray.forEach((path) => {
      if (path) {
        router[routerMethod](path, middleware);
      } else {
        router[routerMethod](middleware);
      }
    });
  });
}

/**
 * Attaches the middleware to the main router.
 * @param {Router} router
 * @param {Function[]|Router[]} middleware
 * @return {Router}
 */
function attachMiddleware(router, middleware) {
  middleware.forEach((middlewareConfig) => {
    parseMiddleware(router, middlewareConfig);
  });

  return router;
}

module.exports = attachMiddleware;

// Exposed for testing
module.exports.enforceArray = enforceArray;
module.exports.parseMiddleware = parseMiddleware;
