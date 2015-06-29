/**
 * Controller for URIs
 *
 * @module
 */

'use strict';

var responses = require('../responses'),
  db = require('../services/db');

/**
 * @param {object} req
 * @param {object} res
 */
function getUriFromReference(req, res) {
  responses.expectText(function () {
    return db.get(responses.normalizePath(req.baseUrl + req.url));
  }, res);
}

/**
 * @param {object} req
 * @param {object} res
 */
function putUriFromReference(req, res) {
  responses.expectText(function () {
    return db.put(responses.normalizePath(req.baseUrl + req.url), req.body).return(req.body);
  }, res);
}

function routes(router) {
  router.use(responses.varyWithoutExtension({varyBy: ['Accept']}));

  router.all('/', responses.methodNotAllowed({allow: ['get']}));
  router.all('/', responses.notAcceptable({accept: ['application/json']}));
  router.get('/', responses.list());
  router.all('/:name', responses.methodNotAllowed({allow: ['get', 'put']}));
  router.all('/:name', responses.notAcceptable({accept: ['text/plain']}));
  router.get('/:name', getUriFromReference);
  router.put('/:name', putUriFromReference);
  router.post('/', responses.notImplemented);
}

module.exports = routes;
