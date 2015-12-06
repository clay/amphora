/**
 * Controller for Components
 *
 * @module
 */

'use strict';

var _ = require('lodash'),
  responses = require('../responses'),
  htmlComposer = require('../html-composer'),
  files = require('../files'),
  queryStringOptions = ['ignore-data'],
  controller = require('../services/components'),
  acceptedExtensions = {
    html: 'text/html',
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
      return controller.get(req.uri, res.locals);
    }, res);
  },

  list: function (req, res) {
    responses.expectJSON(function () {
      return controller.list();
    }, res);
  },

  /**
   * @param req
   * @param res
   */
  put: function (req, res) {
    responses.expectJSON(function () {
      return controller.put(req.uri, req.body, res.locals);
    }, res);
  },

  /**
   * @param req
   * @param res
   */
  del: function (req, res) {
    responses.expectJSON(function () {
      return controller.del(req.uri, res.locals);
    }, res);
  },

  /**
   * @param req
   * @param res
   */
  post: function (req, res) {
    responses.expectJSON(function () {
      return controller.post(req.uri, req.body, res.locals);
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
      return controller.getSchema(req.uri);
    }, res);
  },

  render: function (req, res) {
    responses.expectHTML(function () {
      return htmlComposer.renderComponent(req.uri, res, _.pick(req.query, queryStringOptions));
    }, res);
  }
});

function routes(router) {
  router.use(responses.varyWithoutExtension({varyBy: ['Accept']}));
  router.use(responses.onlyCachePublished);

  router.all('/', responses.methodNotAllowed({allow: ['get']}));
  router.all('/', responses.notAcceptable({accept: ['application/json']}));
  router.get('/', route.list);

  router.all('/:name*', validation.componentMustExist);
  router.get('/:name.:ext', responses.onlyAcceptExtensions({extensions: acceptedExtensions}));
  router.get('/:name.:ext', route.extension);

  router.all('/:name@:version', responses.acceptJSONOnly);
  router.all('/:name@:version', responses.methodNotAllowed({allow: ['get', 'put']}));
  router.get('/:name@:version', route.get);
  router.put('/:name@:version', responses.denyReferenceAtRoot);
  router.put('/:name@:version', route.put);

  router.all('/:name', responses.acceptJSONOnly);
  router.all('/:name', responses.methodNotAllowed({allow: ['get', 'put', 'delete']}));
  router.get('/:name', route.get);
  router.put('/:name', responses.denyReferenceAtRoot);
  router.put('/:name', route.put);
  router.delete('/:name', route.del);

  router.all('/:name/instances', responses.acceptJSONOnly);
  router.all('/:name/instances', responses.methodNotAllowed({allow: ['get', 'post']}));
  router.get('/:name/instances', responses.listWithoutVersions());
  router.post('/:name/instances', responses.denyReferenceAtRoot);
  router.post('/:name/instances', route.post);
  router.get('/:name/instances/:id.:ext', responses.onlyAcceptExtensions({extensions: acceptedExtensions}));
  router.get('/:name/instances/:id.:ext', route.extension);

  router.all('/:name/instances/:id@:version', responses.acceptJSONOnly);
  router.all('/:name/instances/:id@:version', responses.methodNotAllowed({allow: ['get', 'put']}));
  router.get('/:name/instances/:id@:version', route.get);
  router.put('/:name/instances/:id@:version', responses.denyReferenceAtRoot);
  router.put('/:name/instances/:id@:version', route.put);

  router.all('/:name/instances/:id', responses.acceptJSONOnly);
  router.all('/:name/instances/:id', responses.methodNotAllowed({allow: ['get', 'put', 'delete']}));
  router.get('/:name/instances/:id', route.get);
  router.put('/:name/instances/:id', responses.denyReferenceAtRoot);
  router.put('/:name/instances/:id', route.put);
  router.delete('/:name/instances/:id', route.del);

  router.all('/:name/schema', responses.methodNotAllowed({allow: ['get']}));
  router.all('/:name/schema', responses.notAcceptable({accept: ['application/json']}));
  router.get('/:name/schema', route.schema);
}

module.exports = routes;
