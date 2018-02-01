'use strict';

var uriRoutes, renderers,
  log = require('./services/logger').setup({
    file: __filename
  });
const _ = require('lodash'),
  media = require('./media'),
  schema = require('./schema'),
  files = require('./files'),
  url = require('url'),
  buf = require('./services/buffer'),
  components = require('./services/components'),
  references = require('./services/references'),
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
  renderers = renderObj;
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
  var hrStart = process.hrtime(),
    extension = getExtension(req), // Get the extension for the request
    renderer = findRenderer(extension), // Determine which renderer we are using
    uri = req.uri,
    locals = res.locals,
    options = options || {},
    fullRoute = `${uri}.${extension}`;

  // Add request route params, request query params
  // and the request extension to the locals object
  locals.params = req.params;
  locals.query = req.query;
  locals.extension = extension;

  return components.get(uri, locals)
    .then(data => {
      options.version = options.version || uri.split('@')[1];
      options.data = data;
      options.ref = uri; // TODO: `_ref`?

      return formDataForRenderer(options, locals)
        .then(renderer.render);
    })
    .then(logTime(hrStart, 'rendered component route', fullRoute));
}

/**
 * Formatter for rendering time success messages
 *
 * @param  {Object} hrStart
 * @param  {String} msg
 * @param  {String} route
 * @return {Function}
 */
function logTime(hrStart, msg, route) {
  return function (resp) {
    if (resp) {
      const diff = process.hrtime(hrStart),
        ms = Math.floor((diff[0] * 1e9 + diff[1]) / 1000000);

      log('info', `${msg}: ${route} (${ms}ms)`, {
        renderTime: ms,
        route,
        type: resp.type
      });

    }

    return resp;
  };
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
  const locals = res.locals,
    extension = getExtension(req),
    renderer = findRenderer(extension);

  // Add request route params, request query params
  // and the request extension to the locals object
  locals.params = req.params;
  locals.query = req.query;
  locals.extension = extension;

  // look up page alias' component instance
  return getDBObject(uri)
    .then(function (result) {
      const layoutReference = result.layout,
        layoutComponentName = clayUtils.getComponentName(layoutReference),
        pageData = references.omitPageConfiguration(result);

      return components.get(layoutReference, locals)
        .then(mapLayoutToPageData.bind(this, pageData))
        .then(function (result) {
          const options = {
            data: result
          };

          options.version = uri.split('@')[1];
          options.data.template = layoutComponentName;
          options.pageRef = uri;
          options.pageData = pageData;
          options.layoutRef = layoutReference;
          options.ref = uri;
          return module.exports.formDataForRenderer(options, locals)
            .then(renderer.render);
        });
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
 * Get the prefix that normalizes the slash on the path with the expectation that references to routes using the prefix
 * will start with a slash as well.
 *
 * @param {object} site
 * @returns {string}
 */
function getExpressRoutePrefix(site) {
  let prefix = site.host;

  if (site.path.length > 1) {
    prefix += site.path;
  }

  return prefix;
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
      throw new Error('Invalid URI: ' + uri + ': ' + result);
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
    prefix = `${getExpressRoutePrefix(site)}/uris/`,
    pageReference = `${prefix}${buf.encode(req.hostname + req.baseUrl + req.path)}`,
    fullRoute = `${req.hostname}${req.baseUrl}${req.path}`;

  return module.exports.renderUri(pageReference, req, res)
    .then(function (resp) {
      if (resp) {
        res.type(resp.type);
        res.send(resp.output);
      }

      return resp;
    })
    .then(logTime(hrStart, 'rendered Express route', fullRoute))
    .catch((error) => {
      if (error.name === 'NotFoundError') {
        log('error', `in ${req.uri}: ${error.message}`);
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
module.exports.getExpressRoutePrefix = getExpressRoutePrefix;
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
