/**
 * Controller for URIs
 *
 * @module
 */

'use strict';

var responses = require('../responses'),
  references = require('../references');

/**
 * @param req
 * @param res
 */
function getUriFromReference(req, res) {
  responses.expectJSON(function () {
    return references.getUriData(responses.normalizePath(req.baseUrl + req.url));
  }, res);
}

/**
 * @param req
 * @param res
 */
function putUriFromReference(req, res) {
  responses.expectJSON(function () {
    return references.putUriData(responses.normalizePath(req.baseUrl + req.url), req.body);
  }, res);
}

function routes(router) {
  router.all('*', responses.acceptJSONOnly);
  router.all('/', responses.methodNotAllowed({allow: ['get']}));
  router.get('/', responses.list());
  router.all('/:name', responses.methodNotAllowed({allow: ['get', 'put']}));
  router.get('/:name', getUriFromReference);
  router.put('/:name', putUriFromReference);
  router.post('/', responses.notImplemented);
}

module.exports = routes;