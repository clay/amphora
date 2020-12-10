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
 * Add to a list, return JSON
 * @param {Object} req
 * @param {Object} res
 */
function addToList(req, res) {
  responses.expectJSON(() => controller.addToList(req.uri, req.body, res.locals), res);
}

/**
 * Remove from a list, return JSON
 * @param {Object} req
 * @param {Object} res
 */
function removeFromList(req, res) {
  responses.expectJSON(() => controller.removeFromList(req.uri, req.body, res.locals), res);
}

function routes(router) {
  router.use(responses.varyWithoutExtension({varyBy: ['Accept']}));
  router.all('*', responses.acceptJSONOnly);
  router.all('/', responses.methodNotAllowed({allow: ['get']}));
  router.get('/', responses.list());
  router.get('/:name', responses.getRouteFromDB);
  router.post('/:name', withAuthLevel(authLevels.WRITE));
  router.post('/:name', addToList);
  router.delete('/:name', withAuthLevel(authLevels.WRITE));
  router.delete('/:name', removeFromList);
  router.use('/:name', onlyJSONLists);
  router.put('/:name', withAuthLevel(authLevels.WRITE));
  router.put('/:name', responses.putRouteFromDB);
  router.post('/', responses.notImplemented);
}

module.exports = routes;
module.exports.onlyJSONLists = onlyJSONLists;
