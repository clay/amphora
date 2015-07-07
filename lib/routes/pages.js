/**
 * Controller for Pages
 *
 * @module
 */

'use strict';

var _ = require('lodash'),
  responses = require('../responses'),
  composer = require('../composer'),
  controller = require('../services/pages'),
  acceptedExtensions = {
    html: 'text/html',
    json: 'application/json'
  };

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
  post: function (req, res) {
    responses.expectJSON(function () {
      return controller.create(responses.normalizePath(req.baseUrl + req.url), req.body)
        .then(function (result) {
          // creation success!
          res.status(201);
          return result;
        });
    }, res);
  },
  /**
   * @param req
   * @param res
   */
  putPublish: function (req, res) {
    responses.expectJSON(function () {
      return controller.publish(responses.normalizePath(req.baseUrl + req.url), req.body);
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
        req.headers.accept = 'text/html';
        this.render(req, res);
        break;
      case 'json': // jshint ignore:line
      default:
        req.headers.accept = 'application/json';
        responses.getRouteFromDB(req, res);
        break;
    }
  },
  /**
   * @param req
   * @param res
   */
  render: function (req, res) {
    responses.expectHTML(function () {
      return composer.renderPage(responses.normalizePath(req.baseUrl + req.url), res);
    }, res);
  }
});

function routes(router) {
  router.use(responses.varyWithoutExtension({varyBy: ['Accept']}));
  router.use(responses.onlyCachePublished);

  router.all('/', responses.methodNotAllowed({allow: ['get', 'post']}));
  router.all('/', responses.notAcceptable({accept: ['application/json']}));
  router.get('/', responses.listWithoutVersions());
  router.post('/', route.post);

  router.all('/:name.:ext', responses.methodNotAllowed({allow: ['get']}));
  router.all('/:name.:ext', responses.notAcceptable({accept: ['text/html']}));
  router.get('/:name.:ext', responses.onlyAcceptExtensions({extensions: acceptedExtensions}));
  router.get('/:name.:ext', route.extension);

  router.all('/:name@:version', responses.methodNotAllowed({allow: ['get', 'put']}));
  router.all('/:name@:version', responses.acceptJSONOnly);
  router.get('/:name@:version', responses.getRouteFromDB);
  router.put('/:name@published', route.putPublish);
  router.put('/:name@:version', responses.putRouteFromDB);

  router.all('/:name', responses.methodNotAllowed({allow: ['get', 'put']}));
  router.all('/:name', responses.notAcceptable({accept: ['application/json']}));
  router.get('/:name', responses.getRouteFromDB);
  router.put('/:name', responses.putRouteFromDB);
}

module.exports = routes;