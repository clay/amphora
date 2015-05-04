/**
 * Controller for URIs
 *
 * @module
 */

'use strict';

var _ = require('lodash'),
  responses = require('../responses');

/**
 * @param req
 * @param res
 * @param next
 */
function onlyJSONLists(req, res, next) {
  if (req.body && !_.isArray(req.body)) {
    responses.clientError(new Error('Only accepts lists.'), res);
  } else {
    next();
  }
}

function routes(router) {
  router.get('/', responses.listAllWithPrefix);
  router.get('/:name', responses.getRouteFromDB);
  router.use('/:name', onlyJSONLists);
  router.put('/:name', responses.putRouteFromDB);
  router.post('/', responses.notImplemented);
}

module.exports = routes;
module.exports.onlyJSONLists = onlyJSONLists;