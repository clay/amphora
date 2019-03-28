/**
 * Controller for URIs
 *
 * @module
 */

'use strict';

const responses = require('../responses'),
  controller = require('../services/uris'),
  db = require('../services/db'),
  { withAuthLevel, authLevels } = require('amphora-auth');

/**
 * @param {object} req
 * @param {object} res
 */
function getUriFromReference(req, res) {
  responses.expectText(() => db.get(req.uri), res);
}

/**
 * @param {object} req
 * @param {object} res
 */
function putUriFromReference(req, res) {
  responses.expectText(() => controller.put(req.uri, req.body), res);
}

/**
 * @param {object} req
 * @param {object} res
 */
function deleteUriFromReference(req, res) {
  responses.expectText(() => controller.del(req.uri, req.user, res.locals), res);
}

function routes(router) {
  router.use(responses.varyWithoutExtension({varyBy: ['Accept']}));

  router.all('/', responses.methodNotAllowed({allow: ['get']}));
  router.all('/', responses.notAcceptable({accept: ['application/json']}));
  router.get('/', responses.list());
  router.post('/', responses.notImplemented);
  router.all('/:name', responses.methodNotAllowed({allow: ['get', 'put', 'delete']}));
  router.all('/:name', responses.notAcceptable({accept: ['text/plain']}));
  router.all('/:name', responses.denyTrailingSlashOnId);
  router.get('/:name', getUriFromReference);
  router.put('/:name', withAuthLevel(authLevels.WRITE));
  router.put('/:name', putUriFromReference);
  router.delete('/:name', withAuthLevel(authLevels.WRITE)); // Delete is WRITE because unpublish
  router.delete('/:name', deleteUriFromReference);
}

module.exports = routes;
