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

function onlyAcceptExtension(type, req, res, cb) {
  var accepts = req.headers.accept,
    isAll = accepts.indexOf('*/*') !== -1,
    isType = accepts.indexOf(type) !== -1;

  if (!isAll && !isType) {
    responses.notAcceptable({accept: [type]})(req, res);
  } else {
    req.headers.accept = type;
    cb(req, res);
  }
}

/**
 * Change the acceptance type based on the extension they gave us
 *
 * Fail if they don't accept right protocol and not *
 *
 * @param req
 * @param res
 */
function routeByExtension(req, res) {
  switch (req.params.ext.toLowerCase()) {
    case 'html':
      onlyAcceptExtension('text/html', req, res, renderComponent);
      break;

    case 'yaml':
      onlyAcceptExtension('text/yaml', req, res, responses.notImplemented.bind(responses));
      break;

    case 'json': // jshint ignore:line
    default:
      onlyAcceptExtension('application/json', req, res, getRouteFromComponent);
      break;
  }
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
  router.all('/', responses.methodNotAllowed({allow: ['get']}));
  router.get('/', responses.notImplemented);

  router.all('/:name*', componentMustExist);
  router.get('/:name.:ext', routeByExtension);

  router.all('/:name@:version', acceptJSONOnly);
  router.all('/:name@:version', responses.methodNotAllowed({allow: ['get', 'put']}));
  router.get('/:name@:version', getRouteFromComponent);
  router.put('/:name@:version', putRouteFromComponent);

  router.all('/:name', acceptJSONOnly);
  router.all('/:name', responses.methodNotAllowed({allow: ['get', 'put', 'delete']}));
  router.get('/:name', getRouteFromComponent);
  router.put('/:name', putRouteFromComponent);
  router.delete('/:name', deleteRouteFromComponent);

  router.all('/:name/instances', acceptJSONOnly);
  router.all('/:name/instances', responses.methodNotAllowed({allow: ['get']}));
  router.get('/:name/instances', responses.listWithoutVersions());
  router.get('/:name/instances/:id.:ext', routeByExtension);

  router.all('/:name/instances/:id@:version', acceptJSONOnly);
  router.all('/:name/instances/:id@:version', responses.methodNotAllowed({allow: ['get', 'put']}));
  router.get('/:name/instances/:id@:version', getRouteFromComponent);
  router.put('/:name/instances/:id@:version', putRouteFromComponent);

  router.all('/:name/instances/:id', acceptJSONOnly);
  router.all('/:name/instances/:id', responses.methodNotAllowed({allow: ['get', 'put', 'delete']}));
  router.get('/:name/instances/:id', getRouteFromComponent);
  router.put('/:name/instances/:id', putRouteFromComponent);
  router.delete('/:name/instances/:id', deleteRouteFromComponent);

  router.all('/:name/schema', responses.methodNotAllowed({allow: ['get']}));
  router.get('/:name/schema', getSchema);
}

module.exports = routes;