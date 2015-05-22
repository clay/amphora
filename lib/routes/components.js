/**
 * Controller for Components
 *
 * @module
 */

'use strict';

var _ = require('lodash'),
  responses = require('../responses'),
  composer = require('../composer'),
  files = require('../files'),
  queryStringOptions = ['ignore-data'],
  controller = require('../services/components'),
  acceptedExtensions = {
    html: 'text/html',
    yaml: 'text/yaml',
    json: 'application/json'
  };

/**
 * Validation of component routes goes here.
 *
 * They will all have the form (req, res, next).
 *
 * @namespace
 */
let validation = _.bindAll({
  /**
   * If accepts type, run callback.
   */
  onlyAcceptExtension: function (req, res, next) {
    var type, isType,
      ext = req.params.ext.toLowerCase(),
      accepts = req.headers.accept,
      isAll = accepts.indexOf('*/*') !== -1;

    if (!acceptedExtensions[ext]) {
      return responses.notFound(res);
    }

    type = acceptedExtensions[ext];
    isType = accepts.indexOf(type) !== -1;

    if (!isAll && !isType) {
      responses.notAcceptable({accept: [type]})(req, res);
    } else {
      req.headers.accept = type;
      next();
    }
  },

  /**
   * If component doesn't exist, then the resource cannot be found.
   *
   * @param req
   * @param res
   * @param next
   */
  componentMustExist: function (req, res, next) {
    var name = req.params.name;
    name = name.split('@')[0];
    name = name.split('.')[0];

    if (!!files.getComponentPath(name)) {
      next();
    } else {
      responses.notFound(res);
    }
  }
});

/**
 * All routes go here.
 *
 * They will all have the form (req, res), but never with next()
 *
 * @namespace
 */
let route = _.bindAll({

  /**
   * @param req
   * @param res
   */
  get: function (req, res) {
    responses.expectJSON(function () {
      return controller.get(responses.normalizePath(req.baseUrl + req.url));
    }, res);
  },

  /**
   * @param req
   * @param res
   */
  put: function (req, res) {
    responses.expectJSON(function () {
      return controller.put(responses.normalizePath(req.baseUrl + req.url), req.body);
    }, res);
  },

  /**
   * @param req
   * @param res
   */
  del: function (req, res) {
    responses.expectJSON(function () {
      return controller.del(responses.normalizePath(req.baseUrl + req.url));
    }, res);
  },

  /**
   * Change the acceptance type based on the extension they gave us
   *
   * Fail if they don't accept right protocol and not *
   *
   * @param req
   * @param res
   */
  extension: function (req, res) {
    switch (req.params.ext.toLowerCase()) {
      case 'html':
        return this.render(req, res);
      case 'yaml':
        return responses.notImplemented(req, res);
      case 'json': // jshint ignore:line
      default:
        return this.get(req, res);
    }
  },

  /**
   * Return a schema for a component
   *
   * @param req
   * @param res
   */
  schema: function (req, res) {
    responses.expectJSON(function () {
      return controller.getSchema(responses.normalizePath(req.baseUrl + req.url));
    }, res);
  },

  render: function (req, res) {
    responses.expectHTML(function () {
      return composer.renderComponent(responses.normalizePath(req.baseUrl + req.url), res, _.pick(req.query, queryStringOptions));
    }, res);
  }
});

function routes(router) {
  router.use(responses.varyWithoutExtension({varyBy: ['Accept']}));
  router.use(responses.onlyCachePublished);

  router.all('/', responses.methodNotAllowed({allow: ['get']}));
  router.get('/', responses.notImplemented);

  router.all('/:name*', validation.componentMustExist);
  router.get('/:name.:ext', validation.onlyAcceptExtension);
  router.get('/:name.:ext', route.extension);

  router.all('/:name@:version', responses.acceptJSONOnly);
  router.all('/:name@:version', responses.methodNotAllowed({allow: ['get', 'put']}));
  router.get('/:name@:version', route.get);
  router.put('/:name@:version', route.put);

  router.all('/:name', responses.acceptJSONOnly);
  router.all('/:name', responses.methodNotAllowed({allow: ['get', 'put', 'delete']}));
  router.get('/:name', route.get);
  router.put('/:name', route.put);
  router.delete('/:name', route.del);

  router.all('/:name/instances', responses.acceptJSONOnly);
  router.all('/:name/instances', responses.methodNotAllowed({allow: ['get']}));
  router.get('/:name/instances', responses.listWithoutVersions());
  router.get('/:name/instances/:id.:ext', validation.onlyAcceptExtension);
  router.get('/:name/instances/:id.:ext', route.extension);

  router.all('/:name/instances/:id@:version', responses.acceptJSONOnly);
  router.all('/:name/instances/:id@:version', responses.methodNotAllowed({allow: ['get', 'put']}));
  router.get('/:name/instances/:id@:version', route.get);
  router.put('/:name/instances/:id@:version', route.put);

  router.all('/:name/instances/:id', responses.acceptJSONOnly);
  router.all('/:name/instances/:id', responses.methodNotAllowed({allow: ['get', 'put', 'delete']}));
  router.get('/:name/instances/:id', route.get);
  router.put('/:name/instances/:id', route.put);
  router.delete('/:name/instances/:id', route.del);

  router.all('/:name/schema', responses.methodNotAllowed({allow: ['get']}));
  router.all('/:name/schema', responses.notAcceptable({accept: ['application/json']}));
  router.get('/:name/schema', route.schema);
}

module.exports = routes;