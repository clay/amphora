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
      return controller.post(req.uri, req.body, res.locals);
    }, res);
  },
  postAll(req, res) {
    responses.expectJSON(function () {
      return controller.postAll(req.uri, req.body);
    }, res);
  },
  putAll(req, res) {
    responses.expectJSON(function () {
      return controller.putAll(req.uri, req.body);
    }, res);
  },
  deleteAll(req, res) {
    responses.expectJSON(function () {
      return controller.deleteAll(req.uri);
    }, res);
  }
}, [
  'post',
  'postAll',
  'putAll',
  'deleteAll'
]);

function routes(router) {
  router.use(responses.varyWithoutExtension({varyBy: ['Accept']}));

  // list users
  router.all('/', responses.methodNotAllowed({allow: ['get', 'post']}));
  router.all('/', responses.notAcceptable({accept: ['application/json']}));
  router.get('/', responses.list());

  // create new user
  router.post('/', withAuthLevel(authLevels.ADMIN));
  router.post('/', responses.denyReferenceAtRoot);
  router.post('/', route.post);

  // Interact with users across all sites in the Clay instance
  // router.all('/all-sites', responses.methodNotAllowed({allow: ['put', 'post', 'delete']}));
  router.all('/all-sites', withAuthLevel(authLevels.ADMIN))
  router.post('/all-sites', route.postAll);
  router.put('/all-sites/:id', route.putAll);
  router.delete('/all-sites/:id', route.deleteAll);

  // get and update users
  router.all('/:name', responses.acceptJSONOnly);
  router.all('/:name', responses.methodNotAllowed({allow: ['get', 'put', 'delete']}));
  router.all('/:name', responses.denyTrailingSlashOnId);
  router.get('/:name', responses.getRouteFromDB);
  router.put('/:name', responses.denyReferenceAtRoot);
  router.put('/:name', withAuthLevel(authLevels.ADMIN));
  router.put('/:name', responses.putRouteFromDB);
  router.delete('/:id', withAuthLevel(authLevels.ADMIN));
  router.delete('/:id', responses.deleteRouteFromDB);

}

module.exports = routes;
