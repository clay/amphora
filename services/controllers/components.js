/**
 * Controller for Components
 *
 * @module
 */

'use strict';

var references = require('../references'),
  responses = require('../responses'),
// allowable query string variables
  queryStringOptions = ['ignore-data'];

/**
 * returns HTML
 *
 * @param req
 * @param res
 */
function renderComponent(req, res) {
  responses.expectHTML(function () {
    return composer.renderComponent(responses.normalizePath(req.url), res, _.pick(req.query, queryStringOptions));
  }, res);
}

/**
 * @param req
 * @param res
 */
function getRouteFromComponent(req, res) {
  responses.expectJSON(function () {
    return references.getComponentData(responses.normalizePath(req.url));
  }, res);
}

/**
 * @param req
 * @param res
 */
function putRouteFromComponent(req, res) {
  responses.expectJSON(function () {
    return references.putComponentData(responses.normalizePath(req.url), req.body);
  }, res);
}

/**
 * Return a schema for a component
 *
 * @param req
 * @param res
 */
function getSchema(req, res) {
  responses.expectJSON(function () {
    return references.getSchema(responses.normalizePath(req.url));
  }, res);
}

/**
 * Change the acceptance type based on the extension they gave us
 *
 * @param req
 * @param res
 */
function routeByExtension(req, res) {
  log.info('routeByExtension', req.params);

  switch (req.params.ext.toLowerCase()) {
    case 'html':
      req.headers.accept = 'text/html';
      renderComponent(req, res);
      break;

    case 'yaml':
      req.headers.accept = 'text/yaml';
      responses.notImplemented(req, res);
      break;

    case 'json': // jshint ignore:line
    default:
      req.headers.accept = 'application/json';
      getRouteFromComponent(req, res);
      break;
  }
}

function listInstances(req, res) {
  return responses.listAllWithPrefix(req, res);
}

function routes(router) {
  router.get('/', responses.notImplemented);
  router.get('/:name.:ext', routeByExtension);
  router.get('/:name', getRouteFromComponent);
  router.put('/components/:name', putRouteFromComponent);

  router.get('/:name/instances', listInstances);
  router.get('/:name/instances/:id.:ext', routeByExtension);
  router.get('/:name/instances/:id', getRouteFromComponent);
  router.put('/:name/instances/:id', putRouteFromComponent);

  router.get('/:name/schema', getSchema);
}

module.exports = routes;