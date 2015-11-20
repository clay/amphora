/**
 * Controller for Pages
 *
 * @module
 */

'use strict';

var _ = require('lodash'),
  responses = require('../responses'),
  controller = require('../services/schedule');

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
      return controller.create(req.uri, req.body)
        .then(function (result) {
          // creation success!
          res.status(201);
          return result;
        });
    }, res);
  }
});

function routes(router) {
  router.use(responses.varyWithoutExtension({varyBy: ['Accept']}));
  router.use(responses.onlyCachePublished);

  router.all('/', responses.methodNotAllowed({allow: ['get', 'post']}));
  router.all('/', responses.notAcceptable({accept: ['application/json']}));
  router.get('/', responses.list({keys: true, values: true, isArray: true}));
  router.post('/', route.post);

  router.all('/:name', responses.methodNotAllowed({allow: ['get', 'delete']}));
  router.all('/:name', responses.notAcceptable({accept: ['application/json']}));
  router.get('/:name', responses.getRouteFromDB);
  router.delete('/:name', responses.deleteRouteFromDB);
}

module.exports = routes;