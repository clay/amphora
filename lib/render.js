'use strict';

var uriRoutes, renderers,
  log = require('./services/log').setup({ file: __filename });
const _ = require('lodash'),
  media = require('./media'),
  schema = require('./schema'),
  files = require('./files'),
  url = require('url'),
  buf = require('./services/buffer'),
  components = require('./services/components'),
  references = require('./services/references'),
  utils = require('./utils/components'),
  clayUtils = require('clayutils'),
  db = require('./services/db'),
  composer = require('./services/composer'),
  mapLayoutToPageData = require('./utils/layout-to-page-data'),
  control = require('./control');

/**
 * Check the renderers for the request extension. If the
 * request  does not have an extension, grab the default.
 *
 * @param  {Object} req
 * @return {String}
 */
function getExtension(req) {
  return _.get(req, 'params.ext', '') ? req.params.ext.toLowerCase() : renderers.default;
}

/**
 * Register renderers to be referenced.
 *
 * @param  {Object} renderObj
 */
function registerRenderers(renderObj) {
  renderers = _.cloneDeep(renderObj);

  log('trace', 'Registering renderers', {
    renderers: Object.keys(_.omit(renderObj, ['default'])),
    action: 'setup'
  });

  // Export the renderers object
  module.exports.renderers = renderers;
}

/**
 * Register env variables to be referenced
 *
 * @param  {Array} envArray
 */
function registerEnv(envArray) {
  // Export the renderers object
  module.exports.envVars = envArray;
}

/**
 *
 * @param {string} ref
 * @param {object} data
 * @returns {[string]}
 */
function addComponentList(ref, data) {
  const indices = components.getIndices(ref, data),
    componentList = indices && indices.components || [];

  return componentList;
}


/**
 * Only assign if exists in from, and if does not exist in to; also: allow rename.
 * @param {string} from
 * @param {string} to
 * @param {string} fromProp
 * @param {string} [toProp]
 */
function transfer(from, to, fromProp, toProp) {
  toProp = toProp || fromProp;
  if (_.has(from, fromProp) && !_.has(to, toProp)) {
    _.set(to, toProp, _.get(from, fromProp));
  }
}

/**
 * Look through env variables array and return
 * the variables from the `process.env` bject
 *
 * @return {Object}
 */
function resolveEnvVars() {
  var obj = {};

  _.map(module.exports.envVars, function (val) {
    obj[val] = process.env[val];
  });

  return obj;
}

/**
 * Add state to result, which adds functionality and information about this request to the templates.
 * @param {object} options
 * @param {object} locals
 * @returns {Function}
 */
function applyOptions(options, locals) {
  return function (result) {
    let state, { site } = locals, componentList;

    // Initial state object which is the response payload
    state = {
      site,
      locals
    };

    // If we're in edit mode then we want to send across the
    // environment variables that model.js files might need.
    if (locals.edit) {
      state._envVars = module.exports.resolveEnvVars();
    }

    // Get an array of components that are included in the request. This
    // includes the root component (layout or other) that is at the base
    // of the request and its children.
    componentList = addComponentList(options.layoutRef || options.ref, result);

    // if the data has any of these already, do not overwrite them!
    // transfer(options, result, 'template');
    transfer(options, state, 'ref', '_self');
    transfer(options, state, 'pageRef', '_self');
    transfer(options, state, 'pageData', '_pageData');
    transfer(options, state, 'version', '_version');
    transfer(options, state, 'layoutRef', '_layoutRef');

    // Add the list of components to the payload
    _.set(state, '_components', componentList);
    // Grab all the schemas and add them to the payload for pre-loading
    _.set(state, '_componentSchemas', _.map(componentList, function (name) {
      return {
        name: name,
        schema: schema.getSchemaPath(files.getComponentPath(name))
      };
    }));

    // Add in the component data to the state
    _.set(state, '_data', result);

    // If we have components let's grab the references to their styles/scripts.
    // We _should_ have some since every rendered page has a root component,
    // be it layout or a specific component
    if (componentList.length) {
      _.set(state, '_media', media.addMediaMap(componentList, state, locals));
    }

    // Send the state
    return state;
  };
}

/**
 * Find the renderer so to use for the request.
 * @param {String|Undefined} extension
 * @return {Object}
 */
function findRenderer(extension) {
  var renderer;

  // Default to HTML if you don't have an extension
  extension = extension || renderers.default;
  // Get the renderer
  renderer = _.get(renderers, `${extension}`, null);

  if (renderer) {
    return renderer;
  } else {
    throw new Error(`Renderer not found for extension ${extension}`);
  }
}

/**
 * Render a component via whatever renderer should be used
 *
 * @param  {Object} req
 * @param  {Object} res
 * @param  {Object} options
 * @return {Promise}
 */
function renderComponent(req, res, options) {
  var extension = getExtension(req), // Get the extension for the request
    renderer = findRenderer(extension), // Determine which renderer we are using
    uri = req.uri,
    locals = res.locals,
    options = options || {};

  return components.get(uri, locals)
    .then(data => {
      options.version = options.version || uri.split('@')[1];
      options.data = data;
      options.ref = uri; // TODO: `_ref`?

      return formDataForRenderer(options, locals)
        .then(renderer.render);
    });
}

/**
 * Grab a value from the DB and parse it before returning it
 * @param  {String} uri
 * @return {Object}
 */
function getDBObject(uri) {
  return db.get(uri).then(JSON.parse);
}

/**
 * Render a page with the appropriate renderer
 * @param  {String} uri
 * @param  {Object} req
 * @param  {Object} res
 * @return {Promise}
 */
function renderPage(uri, req, res) {
  const hrStart = process.hrtime(),
    locals = res.locals,
    site = locals.site,
    extension = getExtension(req),
    renderer = findRenderer(extension);

  // Add request route params and request queries
  // to the locals object
  locals.params = req.params;
  locals.query = req.query;

  // look up page alias' component instance
  return getDBObject(references.uriSwapInSlug(uri, site))
    .then(function (result) {
      const layoutReference = result.layout,
        layoutComponentName = clayUtils.getComponentName(layoutReference),
        pageData = references.omitPageConfiguration(result);

      return components.get(layoutReference, locals)
        .then(mapLayoutToPageData.bind(this, pageData, site))
        .then(function (result) {
          const options = {
              data: result
            },
            clientUri = references.uriSwapOutSlug(uri, site);

          options.version = uri.split('@')[1];
          options.data.template = layoutComponentName;
          options.pageRef = clientUri;
          options.pageData = pageData;
          options.layoutRef = references.uriSwapOutSlug(layoutReference, site);
          options.ref = clientUri;

          return module.exports.formDataForRenderer(options, locals)
            .then(function (resp) {
              const ms = diffTime(hrStart),
                { url } = locals;

              log('info', `rendered page uri: ${url} (${ms}ms)`, {
                action: 'render',
                url,
                uri,
                renderTime: ms
              });

              return renderer.render(resp);
            });
        });
    })
    .catch(e => {
      throw e;
    });
}

/**
 * Resolve all references for nested objects and form the
 * data up in the expected object to send to a renderer
 * @param  {Object} options
 * @param  {Object} locals
 * @return {Promise}
 */
function formDataForRenderer(options, locals) {
  return composer.resolveComponentReferences(options.data, locals)
    .then(applyOptions(options, locals));
}

/**
 * Redirect to referenced type.
 *
 * Depending on what the uri references, load something different.
 *
 * @param {string} uri
 * @param {object} req
 * @param {object} res
 * @returns {Promise}
 */
function renderUri(uri, req, res) {
  return db.get(uri).then(function (result) {
    const route = _.find(uriRoutes, function (item) {
      return result.match(item.when);
    });

    if (!route) {
      throw new Error(`Invalid URI: ${uri}: ${result}`);;
    }

    if (route.isUri) {
      let newBase64Uri = _.last(result.split('/')),
        newUri = buf.decode(newBase64Uri),
        newPath = url.parse(`${res.req.protocol}://${newUri}`).path,
        newUrl = `${res.req.protocol}://${res.req.hostname}${newPath}`;

      log('info', `Redirecting to ${newUrl}`);
      res.redirect(301, newUrl);
    } else {
      return route.default(result, req, res);
    }
  });
}

/**
 * [diffTime description]
 * @param  {[type]} start [description]
 * @return {[type]}       [description]
 */
function diffTime(start) {
  const diff = process.hrtime(start);

  return Math.floor((diff[0] * 1e9 + diff[1]) / 1000000);
}

/**
 * Run composer by translating url to a "page" by base64ing it.  Errors are handled by Express.
 *
 * @param {Object} req
 * @param {Object} res
 * @param {Function} next
 * @return {Promise}
 */
function renderExpressRoute(req, res, next) {
  var hrStart = process.hrtime(),
    site = res.locals.site,
    prefix = `${site.slug}/_uris/`,
    fullRoute = `${req.hostname}${req.baseUrl}${req.path}`,
    pageReference = `${prefix}${buf.encode(fullRoute)}`;

  return module.exports.renderUri(pageReference, req, res).then((resp) => {
    if (resp) {
      // if we're rendering a route normally, there will be content to sent back
      // if it hits a redirect, there will be nothing here (and we shouldn't try to
      // send headers after the redirect has fired)
      res.type(resp.type);
      res.send(resp.output);

      const ms = diffTime(hrStart);

      log('info', `rendered express route: ${fullRoute} (${ms}ms)`, {
        renderTime: ms,
        route: fullRoute,
        type: resp.type
      });
    }
  }).catch((error) => {
    if (error.name === 'NotFoundError') {
      log('error', `in ${req.uri}: ${error.message} :: ${error.stack}`);
      next();
    } else {
      next(error);
    }
  });
}

/**
 * Assume they're talking about published content unless ?edit
 *
 * NOTE:  This probably shouldn't be our responsibility
 *
 * @param {function} fn
 * @returns {function}
 */
function assumePublishedUnlessEditing(fn) {
  return function (uri, req, res) {
    // ignore version if they are editing; default to 'published'
    if (!_.get(res, 'req.query.edit')) {
      uri = clayUtils.replaceVersion(uri, uri.split('@')[1] || 'published');
    }

    return fn(uri, req, res);
  };
}

/**
 * Check if a renderer exists
 *
 * @param  {String} extension
 * @return {Object|Boolean}
 */
function rendererExists(extension) {
  return _.get(renderers, `[${extension}]`, false);
}

/**
 * @param {*} value
 */
function setUriRouteHandlers(value) {
  uriRoutes = value;
}

/**
 * Uris route as following
 */
function resetUriRouteHandlers() {
  /**
   * URIs can point to many different things, and this list will probably grow.
   * @type {[{when: RegExp, html: function, json: function}]}
   */
  uriRoutes = [
    // assume published
    {
      when: /\/_pages\//,
      default: assumePublishedUnlessEditing(renderPage),
      json: assumePublishedUnlessEditing(getDBObject)
    },
    // assume published
    {
      when: /\/_components\//,
      default: assumePublishedUnlessEditing(renderComponent),
      json: assumePublishedUnlessEditing(components.get)
    },
    // uris are not published, they only exist
    {
      when: /\/_uris\//,
      isUri: true,
      html: renderUri,
      json: db.get
    }];
}

resetUriRouteHandlers();

// Rendering
module.exports = renderExpressRoute;
module.exports.renderComponent = renderComponent;
module.exports.renderPage = renderPage;
module.exports.renderUri = renderUri;
module.exports.formDataForRenderer = formDataForRenderer;
module.exports.applyOptions = applyOptions;
module.exports.resolveEnvVars = control.memoize(resolveEnvVars);

// Render Utils
module.exports.rendererExists = rendererExists;
module.exports.findRenderer = findRenderer;
module.exports.transfer = transfer;

// Setup
module.exports.renderers = {}; // Overriden when a user registers a render object
module.exports.envVars = [];
module.exports.registerRenderers = registerRenderers;
module.exports.registerEnv = registerEnv;

// For Testing
module.exports.resetUriRouteHandlers = resetUriRouteHandlers;
module.exports.setUriRouteHandlers = setUriRouteHandlers;
module.exports.assumePublishedUnlessEditing = assumePublishedUnlessEditing;
module.exports.setLog = function (fakeLog) {
  log = fakeLog;
};
