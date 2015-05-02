/**
 * Controller for URIs
 *
 * @module
 */

'use strict';

var responses = require('../responses');

function routes(router) {
  router.get('/', responses.listAllWithPrefix);
  router.get('/:name', responses.getRouteFromDB);
  router.put('/:name', responses.putRouteFromDB);
  router.post('/', responses.notImplemented);
}

module.exports = routes;