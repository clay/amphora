/**
 * Controller for Components
 *
 * @module
 */

'use strict';

var _ = require('lodash'),
  references = require('../references'),
  responses = require('../responses'),
  composer = require('../composer'),
  log = require('../log'),
  files = require('../files'),
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
    return composer.renderComponent(responses.normalizePath(req.baseUrl + req.url), res, _.pick(req.query, queryStringOptions));
  }, res);
}

/**
 * @param req
 * @param res
 */
function getRouteFromComponent(req, res) {
  responses.expectJSON(function () {
    return references.getComponentData(responses.normalizePath(req.baseUrl + req.url));
  }, res);
}

/**
 * @param req
 * @param res
 */
function putRouteFromComponent(req, res) {
  responses.expectJSON(function () {
    return references.putComponentData(responses.normalizePath(req.baseUrl + req.url), req.body);
  }, res);
}

/**
 * @param req
 * @param res
 */
function deleteRouteFromComponent(req, res) {
  responses.expectJSON(function () {
    return references.deleteComponentData(responses.normalizePath(req.baseUrl + req.url));
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
    return references.getSchema(responses.normalizePath(req.baseUrl + req.url));
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

function componentMustExist(req, res, next) {
  var name = req.params.name;
  name = name.split('@')[0];
  name = name.split('.')[0];

  if (!!files.getComponentPath(name)) {
    next();
  } else {
    responses.notFound(res);
  }
}

function acceptJSONOnly(req, res, next) {
  if (req.accepts('json')) {
    next();
  } else {
    responses.notAcceptable({accept: ['application/json']})(req, res);
  }
}

function routes(router) {
  router.get('/', responses.notImplemented);
  router.all('/', responses.methodNotAllowed({allow: ['get']}));
  router.all('/:name*', componentMustExist);
  router.get('/:name.:ext', routeByExtension);

  router.all('/:name@:version', acceptJSONOnly);
  router.get('/:name@:version', getRouteFromComponent);
  router.put('/:name@:version', putRouteFromComponent);
  router.all('/:name@:version', responses.methodNotAllowed({allow: ['get', 'put']}));

  router.all('/:name', acceptJSONOnly);
  router.get('/:name', getRouteFromComponent);
  router.put('/:name', putRouteFromComponent);
  router.delete('/:name', deleteRouteFromComponent);
  router.all('/:name', responses.methodNotAllowed({allow: ['get', 'put', 'delete']}));



  router.all('/:name/instances', acceptJSONOnly);
  router.get('/:name/instances', listInstances);
  router.all('/:name/instances', responses.methodNotAllowed({allow: ['get']}));
  router.get('/:name/instances/:id.:ext', routeByExtension);

  router.all('/:name/instances/:id@:version', acceptJSONOnly);
  router.get('/:name/instances/:id@:version', getRouteFromComponent);
  router.put('/:name/instances/:id@:version', putRouteFromComponent);
  router.all('/:name/instances/:id@:version', responses.methodNotAllowed({allow: ['get', 'put']}));

  router.all('/:name/instances/:id', acceptJSONOnly);
  router.get('/:name/instances/:id', getRouteFromComponent);
  router.put('/:name/instances/:id', putRouteFromComponent);
  router.delete('/:name/instances/:id', deleteRouteFromComponent);
  router.all('/:name/instances/:id', responses.methodNotAllowed({allow: ['get', 'put', 'delete']}));

  router.get('/:name/schema', getSchema);
  router.all('/:name/schema', responses.methodNotAllowed({allow: ['get']}));
}

module.exports = routes;