'use strict';

const _ = require('lodash'),
  responses = require('../responses'),
  controller = require('../services/lists'),
  { withAuthLevel, authLevels } = require('amphora-auth');

/**
 * @param {object} req
 * @param {object} res
 * @param {Function} next
 */
function onlyJSONLists(req, res, next) {
  if (req.body && !_.isArray(req.body)) {
    responses.clientError(new Error('Only accepts lists.'), res);
  } else {
    next();
  }
}

/**
 * Modify a list, return JSON
 * @param {Object} req
 * @param {Object} res
 */
function patchList(req, res) {
  responses.expectJSON(() => controller.patchList(req.uri, req.body, res.locals), res);
}

function routes(router) {
  router.use(responses.varyWithoutExtension({varyBy: ['Accept']}));
  router.all('*', responses.acceptJSONOnly);
  router.all('/', responses.methodNotAllowed({allow: ['get']}));
  router.get('/', responses.list());
  router.all('/:name', responses.methodNotAllowed({allow: ['get', 'put', 'patch']}));
  router.get('/:name', responses.getRouteFromDB);
  router.patch('/:name', withAuthLevel(authLevels.WRITE));
  router.patch('/:name', patchList);
  router.use('/:name', onlyJSONLists);
  router.put('/:name', withAuthLevel(authLevels.WRITE));
  router.put('/:name', responses.putRouteFromDB);
  router.post('/', responses.notImplemented);
}

module.exports = routes;
module.exports.onlyJSONLists = onlyJSONLists;
module.exports.patchList = patchList;
