/**
 * Controller for URIs
 *
 * @module
 */

'use strict';

const responses = require('../responses'),
  controller = require('../services/uris');

/**
 * @param {object} req
 * @param {object} res
 */
function getUriFromReference(req, res) {
  responses.expectText(function () {
    return controller.get(req.uri);
  }, res);
}

/**
 * @param {object} req
 * @param {object} res
 */
function putUriFromReference(req, res) {
  responses.expectText(function () {
    return controller.put(req.uri, req.body);
  }, res);
}

/**
 * @param {object} req
 * @param {object} res
 */
function deleteUriFromReference(req, res) {
  responses.expectText(function () {
    return controller.del(req.uri);
  }, res);
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
  router.put('/:name', putUriFromReference);
  router.delete('/:name', deleteUriFromReference);
}

module.exports = routes;
