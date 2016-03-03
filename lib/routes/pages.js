/**
 * Controller for Pages
 *
 * @module
 */

'use strict';

const _ = require('lodash'),
  responses = require('../responses'),
  htmlComposer = require('../html-composer'),
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
  post(req, res) {
    responses.expectJSON(function () {
      return controller.create(req.uri, req.body, res.locals)
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
  putPublish(req, res) {
    responses.expectJSON(function () {
      return controller.publish(req.uri, req.body, res.locals);
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
  extension(req, res) {
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
  render(req, res) {
    responses.expectHTML(function () {
      return htmlComposer.renderPage(req.uri, res);
    }, res);
  }
});

function routes(router) {
  router.use(responses.varyWithoutExtension({varyBy: ['Accept']}));
  router.use(responses.onlyCachePublished);

  router.all('/', responses.methodNotAllowed({allow: ['get', 'post']}));
  router.all('/', responses.notAcceptable({accept: ['application/json']}));
  router.get('/', responses.listWithoutVersions());
  router.post('/', responses.denyReferenceAtRoot);
  router.post('/', route.post);

  router.all('/:name.:ext', responses.methodNotAllowed({allow: ['get']}));
  router.get('/:name.:ext', responses.onlyAcceptExtensions({extensions: acceptedExtensions}));
  router.get('/:name.:ext', route.extension);

  router.all('/:name@:version', responses.methodNotAllowed({allow: ['get', 'put', 'delete']}));
  router.all('/:name@:version', responses.acceptJSONOnly);
  router.get('/:name@:version', responses.getRouteFromDB);
  router.put('/:name@:version', responses.denyReferenceAtRoot);
  router.put('/:name@published', route.putPublish);
  router.put('/:name@:version', responses.putRouteFromDB);
  router.delete('/:name@:version', responses.deleteRouteFromDB);

  router.all('/:name', responses.methodNotAllowed({allow: ['get', 'put', 'delete']}));
  router.all('/:name', responses.notAcceptable({accept: ['application/json']}));
  router.get('/:name', responses.getRouteFromDB);
  router.put('/:name', responses.denyReferenceAtRoot);
  router.put('/:name', responses.putRouteFromDB);
  router.delete('/:name', responses.deleteRouteFromDB);
}

module.exports = routes;