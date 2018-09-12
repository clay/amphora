'use strict';

const _ = require('lodash'),
  responses = require('../responses'),
  render = require('../render'),
  bus = require('../services/bus'),
  db = require('../services/db'),
  files = require('../files'),
  metaController = require('../services/metadata'),
  { getSchema } = require('../utils/schema'),
  { withAuthLevel, authLevels } = require('../auth'),
  controller = require('../services/layouts');

let validation, route;

/**
 * get composed component data
 * @param  {string} uri of root component
 * @param  {object} locals
 * @return {Promise} composed data of root component and children
 */
function getComposed(uri, locals) {
  return controller.get(uri, locals).then(data => {
    // TODO: Check that we can't just reference the composer
    // require here because otherwise it's a circular dependency (via html-composer)
    return require('../services/composer').resolveComponentReferences(data, locals);
  });
}

/**
 * Validation of component routes goes here.
 *
 * They will all have the form (req, res, next).
 *
 * @namespace
 */
validation = _.bindAll({
  /**
   * If component doesn't exist, then the resource cannot be found.
   *
   * @param {object} req
   * @param {object} res
   * @param {Function} next
   */
  componentMustExist(req, res, next) {
    let name = req.params.name;

    name = name.split('@')[0];
    name = name.split('.')[0];

    if (!!files.getLayoutPath(name)) {
      next();
    } else {
      responses.notFound(res);
    }
  }
}, ['componentMustExist']);

/**
 * All routes go here.
 *
 * They will all have the form (req, res), but never with next()
 *
 * @namespace
 */
route = _.bindAll({

  /**
   * @param {object} req
   * @param {object} res
   */
  get(req, res) {
    responses.expectJSON(() => controller.get(req.uri, res.locals), res);
  },

  /**
   * @param {object} req
   * @param {object} res
   */
  list(req, res) {
    responses.expectJSON(function () {
      return files.getLayouts();
    }, res);
  },

  /**
   * @param {object} req
   * @param {object} res
   */
  published(req, res) {
    responses.expectJSON(function () {
      return controller.publish(req.uri, req.body, res.locals);
    }, res);
  },

  /**
   * @param {object} req
   * @param {object} res
   */
  put(req, res) {
    const data = req.body,
      user = res.locals && res.locals.user,
      uri = req.uri;

    responses.expectJSON(() => {
      return db.getLatestData(uri)
        .then(() => controller.put(uri, data, res.locals))
        .catch(() => {
          return controller.put(uri, data, res.locals)
            .then(resp => metaController.createLayout(uri, user).then(() => {
              bus.publish('createLayout', JSON.stringify({ uri, data, user }));
              return resp;
            }));
        });
    }, res);
  },

  /**
   * @param {object} req
   * @param {object} res
   */
  post(req, res) {
    responses.expectJSON(() => controller.post(req.uri, req.body, res.locals), res);
  },

  /**
   * GET returning html or json depending on extension
   *
   * Fail if they don't accept right protocol and not *
   *
   * @param {object} req
   * @param {object} res
   * @returns {Function}
   */
  getExtension(req, res) {
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
   * PUT returning html or json depending on extension
   * @param {object} req
   * @param {object} res
   * @returns {Function}
   */
  putExtension(req, res) {
    return responses.expectJSON(function () {
      return controller.put(req.uri, req.body, res.locals)
        .then(function () {
          return getComposed(req.uri, res.locals);
        });
    }, res);
  },

  /**
   * Return a schema for a component
   *
   * @param {object} req
   * @param {object} res
   */
  schema(req, res) {
    responses.expectJSON(() => getSchema(req.uri), res);
  },

  /**
   * Render a component
   *
   * @param  {Object} req
   * @param  {Object} res
   *
   */
  render(req, res) {
    render.renderComponent(req, res, process.hrtime());
  },

  /**
   * Overwrite the metadata for a particular
   * layout instance
   *
   * @param  {Object} req
   * @param  {Object} res
   */
  putMeta(req, res) {
    responses.expectJSON(() => metaController.putMeta(req.uri, req.body), res);
  },

  /**
   * Retrieve the metadata for a particular
   * layout instance
   *
   * @param  {Object} req
   * @param  {Object} res
   */
  getMeta(req, res) {
    responses.expectJSON(() => metaController.getMeta(req.uri), res);
  },

  /**
   * Overwrite the specific properties in the
   * metadata for a particular layout instance
   *
   * @param  {Object} req
   * @param  {Object} res
   */
  patchMeta(req, res) {
    responses.expectJSON(() => metaController.patchMeta(req.uri, req.body), res);
  }
}, [
  'get',
  'list',
  'published',
  'put',
  'post',
  'getExtension',
  'putExtension',
  'schema',
  'render',
  'putMeta',
  'getMeta',
  'patchMeta'
]);

function routes(router) {
  router.use(responses.varyWithoutExtension({
    varyBy: ['Accept']
  }));
  router.use(responses.onlyCachePublished);

  router.all('/', responses.methodNotAllowed({
    allow: ['get']
  }));

  router.all('/', responses.notAcceptable({
    accept: ['application/json']
  }));
  router.get('/', route.list);

  router.all('/:name*', validation.componentMustExist);
  router.get('/:name.:ext', route.getExtension);

  router.all('/:name', responses.acceptJSONOnly);
  router.all('/:name', responses.methodNotAllowed({
    allow: ['get', 'put', 'delete']
  }));
  router.all('/:name', responses.denyTrailingSlashOnId);
  router.get('/:name', route.get);
  router.put('/:name', responses.denyReferenceAtRoot);
  router.put('/:name', withAuthLevel(authLevels.WRITE));
  router.put('/:name', route.put);

  router.all('/:name/instances', responses.acceptJSONOnly);
  router.all('/:name/instances', responses.methodNotAllowed({
    allow: ['get', 'post']
  }));
  router.get('/:name/instances', responses.listWithoutVersions());
  router.post('/:name/instances', responses.denyReferenceAtRoot);
  router.post('/:name/instances', withAuthLevel(authLevels.WRITE));
  router.post('/:name/instances', route.post);

  router.get('/:name/instances/@published', responses.listWithPublishedVersions);

  router.all('/:name/instances/:id.:ext', responses.methodNotAllowed({
    allow: ['get', 'put']
  }));

  // We let any extension be retrieved because we can have different renderers,
  // but we only let `PUT` requests come through root component instances
  // or `.json` extensions
  router.get('/:name/instances/:id.:ext', route.getExtension);
  router.put('/:name/instances/:id.json', responses.denyReferenceAtRoot);
  router.put('/:name/instances/:id.json', withAuthLevel(authLevels.WRITE));
  router.put('/:name/instances/:id.json', route.putExtension);

  router.all('/:name/instances/:id@published', responses.acceptJSONOnly);
  router.all('/:name/instances/:id@published', responses.methodNotAllowed({
    allow: ['get', 'put', 'delete']
  }));
  router.all('/:name/instances/:id@published', responses.denyTrailingSlashOnId);
  router.get('/:name/instances/:id@published', route.get);
  router.get('/:name/instances/:id@published.:ext', route.getExtension);
  // Any component can be published
  router.put('/:name/instances/:id@published', responses.denyReferenceAtRoot);
  router.put('/:name/instances/:id@published', withAuthLevel(authLevels.WRITE));
  router.put('/:name/instances/:id@published', route.published);
  router.delete('/:name/instances/:id@published', withAuthLevel(authLevels.ADMIN));
  router.delete('/:name/instances/:id@published', responses.deleteRouteFromDB);

  router.all('/:name/instances/:id', responses.acceptJSONOnly);
  router.all('/:name/instances/:id', responses.methodNotAllowed({
    allow: ['get', 'put', 'delete']
  }));
  router.all('/:name/instances/:id', responses.denyTrailingSlashOnId);
  router.get('/:name/instances/:id', route.get);
  router.put('/:name/instances/:id', responses.denyReferenceAtRoot);
  router.put('/:name/instances/:id', withAuthLevel(authLevels.WRITE));
  router.put('/:name/instances/:id', route.put);
  router.delete('/:name/instances/:id', withAuthLevel(authLevels.ADMIN));
  router.delete('/:name/instances/:id', responses.deleteRouteFromDB);

  // Meta routes
  router.all('/:name/instances/:id@published/meta', responses.methodNotAllowed({allow: ['get']}));
  router.get('/:name/instances/:id@published/meta', responses.forceEditableInstance());

  router.all('/:name/instances/:id/meta', responses.methodNotAllowed({allow: ['get', 'put', 'patch']}));
  router.all('/:name/instances/:id/meta', responses.notAcceptable({accept: ['application/json']}));
  router.all('/:name/instances/:id/meta', responses.denyTrailingSlashOnId);
  router.get('/:name/instances/:id/meta', route.getMeta);
  router.put('/:name/instances/:id/meta', responses.denyReferenceAtRoot);
  router.put('/:name/instances/:id/meta', withAuthLevel(authLevels.WRITE));
  router.put('/:name/instances/:id/meta', route.putMeta);
  router.patch('/:name/instances/:id/meta', responses.denyReferenceAtRoot);
  router.patch('/:name/instances/:id/meta', withAuthLevel(authLevels.WRITE));
  router.patch('/:name/instances/:id/meta', route.patchMeta);

  // Need to have the delete route instance below or else it'll catch everything
  router.delete('/:name', withAuthLevel(authLevels.ADMIN));
  router.delete('/:name', responses.deleteRouteFromDB);

  router.all('/:name/schema', responses.methodNotAllowed({
    allow: ['get']
  }));
  router.all('/:name/schema', responses.notAcceptable({
    accept: ['application/json']
  }));
  router.get('/:name/schema', route.schema);
}

module.exports = routes;
module.exports.route = route; // For testing of custom rendering
