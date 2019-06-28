'use strict';

const _ = require('lodash'),
  responses = require('../responses'),
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

function routes(router) {
  router.use(responses.varyWithoutExtension({varyBy: ['Accept']}));
  router.all('*', responses.acceptJSONOnly);
  router.all('/', responses.methodNotAllowed({allow: ['get']}));
  router.get('/', responses.list());
  router.all('/:name', responses.methodNotAllowed({allow: ['get', 'put']}));
  router.get('/:name', responses.getRouteFromDB);
  router.use('/:name', onlyJSONLists);
  router.put('/:name', withAuthLevel(authLevels.WRITE));
  router.put('/:name', responses.putRouteFromDB);
  router.post('/', responses.notImplemented);
}

module.exports = routes;
module.exports.onlyJSONLists = onlyJSONLists;
