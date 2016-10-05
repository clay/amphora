/**
 * Controller for Users
 *
 * @module
 */

'use strict';

const _ = require('lodash'),
  responses = require('../responses'),
  controller = require('../services/users');

/**
 * All routes go here.
 *
 * They will all have the form (req, res), but never with next()
 *
 * @namespace
 */
let route = _.bindAll({
  /**
   * @param {object} req
   * @param {object} res
   */
  post(req, res) {
    responses.expectJSON(function () {
      return controller.post(req.uri, req.body, res.locals);
    }, res);
  }
}, [
  'post'
]);

function routes(router) {
  router.use(responses.varyWithoutExtension({varyBy: ['Accept']}));

  // list users
  router.all('/', responses.methodNotAllowed({allow: ['get', 'post']}));
  router.all('/', responses.notAcceptable({accept: ['application/json']}));
  router.get('/', responses.list());

  // create new user
  router.post('/', responses.denyReferenceAtRoot);
  router.post('/', route.post);

  // get and update users
  router.all('/:name', responses.acceptJSONOnly);
  router.all('/:name', responses.methodNotAllowed({allow: ['get', 'put', 'delete']}));
  router.all('/:name', responses.denyTrailingSlashOnId);
  router.get('/:name', responses.getRouteFromDB);
  router.put('/:name', responses.denyReferenceAtRoot);
  router.put('/:name', responses.putRouteFromDB);
  router.delete('/:id', responses.deleteRouteFromDB);
}

module.exports = routes;
