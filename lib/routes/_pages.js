/**
 * Controller for Pages
 *
 * @module
 */

'use strict';

const _ = require('lodash'),
  responses = require('../responses'),
  render = require('../render'),
  controller = require('../services/pages'),
  { uriPrefixToSlug } = require('clayutils'),
  composer = require('../services/composer'),
  db = require('../services/db'),
  { withAuthLevel, authLevels } = require('../auth');

/**
 * get composed component data
 * @param  {string} uri    of root component
 * @param  {object} locals
 * @return {Promise}        composed data of root component and children
 */
function getComposed(uri, locals) {
  const { site } = locals;

  return db.get(uriPrefixToSlug(uri, site))
    .then(JSON.parse)
    .then(pageData => composer.composePage(pageData, locals));
}

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
      return controller.create(req.uri, req.body, res.locals)
        .then(function (result) {
          // creation success!
          res.status(201);
          return result;
        });
    }, res);
  },
  /**
   * @param {object} req
   * @param {object} res
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
   * @param {object} req
   * @param {object} res
   * @returns {Promise}
   */
  extension(req, res) {
    // Check if the extension is included in the renderers
    // that have been registered for the application
    if (render.rendererExists(req.params.ext.toLowerCase())) {
      this.render(req, res);
    } else {
      // Otherwise let's send back JSON as the response
      return responses.expectJSON(function () {
        return getComposed(req.uri, res.locals);
      }, res);
    }
  },
  /**
   * Run data through the renderer for a requested extension
   *
   * @param {object} req
   * @param {object} res
   */
  render(req, res) {
    responses.expectResponseType(function () {
      return render.renderPage(req.uri, req, res);
    }, res);
  }
}, [
  'post',
  'putPublish',
  'extension',
  'render'
]);

function routes(router) {
  router.use(responses.varyWithoutExtension({varyBy: ['Accept']}));
  router.use(responses.onlyCachePublished);

  router.all('/', responses.methodNotAllowed({allow: ['get', 'post']}));
  router.all('/', responses.notAcceptable({accept: ['application/json']}));
  router.get('/', responses.listAndSwapPrefix);
  router.get('/@published', responses.listWithPublishedVersions);
  router.post('/', responses.denyReferenceAtRoot);
  router.post('/', withAuthLevel(authLevels.WRITE));
  router.post('/', route.post);

  router.all('/:name.:ext', responses.methodNotAllowed({allow: ['get']}));
  router.get('/:name.:ext', route.extension);

  router.all('/:name@:version', responses.methodNotAllowed({allow: ['get', 'put', 'delete']}));
  router.all('/:name@:version', responses.acceptJSONOnly);
  router.all('/:name@:version', responses.denyTrailingSlashOnId);
  router.get('/:name@:version', responses.getRouteFromDB);
  router.put('/:name@:version', responses.denyReferenceAtRoot);
  router.put('/:name@published', withAuthLevel(authLevels.WRITE));
  router.put('/:name@published', route.putPublish);
  router.put('/:name@:version', withAuthLevel(authLevels.WRITE));
  router.put('/:name@:version', responses.putRouteFromDB);
  router.delete('/:name@scheduled', withAuthLevel(authLevels.WRITE));
  router.delete('/:name@scheduled', responses.deleteRouteFromDB);
  router.delete('/:name@:version', withAuthLevel(authLevels.ADMIN));
  router.delete('/:name@:version', responses.deleteRouteFromDB);

  router.all('/:name', responses.methodNotAllowed({allow: ['get', 'put', 'delete']}));
  router.all('/:name', responses.notAcceptable({accept: ['application/json']}));
  router.all('/:name', responses.denyTrailingSlashOnId);
  router.get('/:name', responses.getRouteFromDB);
  router.put('/:name', responses.denyReferenceAtRoot);
  router.put('/:name', withAuthLevel(authLevels.WRITE));
  router.put('/:name', responses.putRouteFromDB);
  router.delete('/:name', withAuthLevel(authLevels.ADMIN));
  router.delete('/:name', responses.deleteRouteFromDB);
}

module.exports = routes;
module.exports.route = route; // For testing
