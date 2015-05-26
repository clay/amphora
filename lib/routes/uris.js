/**
 * Controller for URIs
 *
 * @module
 */

'use strict';

var responses = require('../responses'),
  db = require('../services/db');

/**
 * @param req
 * @param res
 */
function getUriFromReference(req, res) {
  responses.expectJSON(function () {
    return db.get(responses.normalizePath(req.baseUrl + req.url));
  }, res);
}

/**
 * @param req
 * @param res
 */
function putUriFromReference(req, res) {
  responses.expectJSON(function () {
    return db.put(responses.normalizePath(req.baseUrl + req.url), req.body).return(req.body);
  }, res);
}

function routes(router) {
  router.use(responses.varyWithoutExtension({varyBy: ['Accept']}));

  router.all('*', responses.acceptJSONOnly);
  router.all('/', responses.methodNotAllowed({allow: ['get']}));
  router.get('/', responses.list());
  router.all('/:name', responses.methodNotAllowed({allow: ['get', 'put']}));
  router.get('/:name', getUriFromReference);
  router.put('/:name', putUriFromReference);
  router.post('/', responses.notImplemented);
}

module.exports = routes;