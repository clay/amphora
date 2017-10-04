/**
 * Controller for Users
 *
 * @module
 */

'use strict';

const _ = require('lodash'),
  responses = require('../responses'),
  controller = require('../services/users'),
  { withAuthLevel, authLevels } = require('../auth');

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
      return controller.post(req.body);
    }, res);
  }
}, [
  'post'
]);

/**
 * We want to trim the everything before /users/ out of
 * the request uri when trying to interact directly with
 * one existing user from any site.
 *
 * @param  {Object} req
 * @param  {Object} res
 * @param  {Function} next
 */
function trimToUserKey(req, res, next) {
  req.uri = req.uri.substring(req.uri.indexOf('/users/'));
  next();
}

function routes(router) {
  router.use(responses.varyWithoutExtension({varyBy: ['Accept']}));

  // list users
  router.all('/', responses.methodNotAllowed({allow: ['get', 'post']}));
  router.all('/', responses.notAcceptable({accept: ['application/json']}));
  router.get('/', responses.listUsers());

  // create new user
  router.post('/', responses.denyReferenceAtRoot);
  router.post('/', withAuthLevel(authLevels.ADMIN));
  router.post('/', route.post);

  // get and update users
  router.all('/:name', responses.acceptJSONOnly);
  router.all('/:name', responses.methodNotAllowed({allow: ['get', 'put', 'delete']}));
  router.all('/:name', responses.denyTrailingSlashOnId);
  router.use('/:name', trimToUserKey);
  router.get('/:name', responses.getRouteFromDB);
  router.put('/:name', responses.denyReferenceAtRoot);
  router.put('/:name', withAuthLevel(authLevels.ADMIN));
  router.put('/:name', responses.putRouteFromDB);
  router.delete('/:id', withAuthLevel(authLevels.ADMIN));
  router.delete('/:id', responses.deleteRouteFromDB);
}

module.exports = routes;
