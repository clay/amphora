'use strict';

var uriRoutes, renderers,
  db = require('./services/db'),
  log = require('./services/logger').setup({
    file: __filename,
    action: 'render'
  });
const _ = require('lodash'),
  url = require('url'),
  buf = require('./services/buffer'),
  components = require('./services/components'),
  references = require('./services/references'),
  clayUtils = require('clayutils'),
  composer = require('./services/composer'),
  responses = require('./responses'),
  mapLayoutToPageData = require('./utils/layout-to-page-data');

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
    return new Error(`Renderer not found for extension ${extension}`);
  }
}

/**
 * Render a component via whatever renderer should be used
 *
 * @param  {Object} req
 * @param  {Object} res
 * @param  {Object} hrStart
 * @return {Promise}
 */
function renderComponent(req, res, hrStart) {
  var extension = getExtension(req), // Get the extension for the request
    renderer = findRenderer(extension), // Determine which renderer we are using
    _ref = req.uri,
    locals = res.locals,
    options = options || {};

  if (renderer instanceof Error) {
    log('error', renderer);
    return Promise.reject(renderer);
  }
  // Add request route params, request query params
  // and the request extension to the locals object
  locals.params = req.params;
  locals.query = req.query;
  locals.extension = extension;

  return components.get(_ref, locals)
    .then(cmptData => formDataForRenderer(cmptData, { _ref }, locals))
    .tap(logTime(hrStart, _ref))
    .then(({data, options}) => renderer.render(data, options, res))
    .catch(err => log('error', err));
}

/**
 * Grab a value from the DB and parse it before returning it
 * @param  {String} uri
 * @return {Object}
 */
function getDBObject(uri) {
  return db.get(uri);
}

/**
 * Render a page with the appropriate renderer
 * @param  {String} uri
 * @param  {Object} req
 * @param  {Object} res
 * @param  {Object} hrStart
 * @return {Promise}
 */
function renderPage(uri, req, res, hrStart) {
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
    .then(formDataFromLayout(locals, uri))
    .then(data => {
      logTime(hrStart, uri);
      return data;
    })
    .then(({ data, options }) => renderer.render(data, options, res))
    .catch(responses.handleError(res));
}

/**
 * Given a pageId, render the page directly from a call
 * to an Express route without trying to match to a uri
 * directly
 *
 * @param  {String} pageId
 * @return {Function}
 */
function renderDynamicRoute(pageId) {
  return (req, res) => {
    const hrStart = process.hrtime(),
      site = res.locals.site,
      pageUri = `${getExpressRoutePrefix(site)}/_pages/${pageId}@published`;

    return module.exports.renderPage(pageUri, req, res, hrStart);
  };
}

/**
 * Given a page uri, get it from the db, resolve the layout,
 * map page data to the page ares and then format all the
 * data for the renderer
 *
 * @param  {Object} locals
 * @param  {String} uri
 * @return {Function<Promise>}
 */
function formDataFromLayout(locals, uri) {
  return function (result) {
    const _layoutRef = result.layout,
      pageData = references.omitPageConfiguration(result);

    return components.get(_layoutRef, locals)
      .then(layout => mapLayoutToPageData(pageData, layout))
      .then(mappedData => module.exports.formDataForRenderer(mappedData, { _layoutRef, _ref: uri }, locals));
  };
}

/**
 * Resolve all references for nested objects and form the
 * data up in the expected object to send to a renderer
 * @param  {Object} unresolvedData
 * @param  {Object} options
 * @param  {Object} locals
 * @return {Promise}
 */
function formDataForRenderer(unresolvedData, { _layoutRef, _ref }, locals) {
  return composer.resolveComponentReferences(unresolvedData, locals)
    .then((data) => ({
      data,
      options: { locals, _ref, _layoutRef }
    }));
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
 * @param {object} hrStart
 * @returns {Promise}
 */
function renderUri(uri, req, res, hrStart) {
  hrStart = hrStart || process.hrtime(); // Check if we actually have a start time

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
        newUrl = `${res.req.protocol}://${res.req.hostname}${newPath}`,
        queryString = req._parsedUrl.search;

      if (queryString) newUrl += queryString;

      log('info', `Redirecting to ${newUrl}`);
      res.redirect(301, newUrl);
    } else {
      return route.default(result, req, res, hrStart);
    }
  });
}

/**
 * Log the timing for data composition
 *
 * @param  {Object} hrStart
 * @param  {String} uri
 * @return {Function}
 */
function logTime(hrStart, uri) {
  return () => {
    const diff = process.hrtime(hrStart),
      ms = Math.floor((diff[0] * 1e9 + diff[1]) / 1000000);

    log('info', `composed data for: ${uri} (${ms}ms)`, {
      composeTime: ms,
      uri
    });
  };
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
    prefix = `${getExpressRoutePrefix(site)}/_uris/`,
    pageReference = `${prefix}${buf.encode(req.hostname + req.baseUrl + req.path)}`;

  return module.exports.renderUri(pageReference, req, res, hrStart)
    .catch((error) => {
      if (error.name === 'NotFoundError') {
        log('error', `could not find resource ${req.uri}`, {
          message: error.message
        });
        next();
      } else {
        next(error);
      }
    });
}

/**
 * Assume they're talking about published content unless ?edit
 *
 * @param {function} fn
 * @returns {function}
 */
function assumePublishedUnlessEditing(fn) {
  return function (uri, req, res, hrStart) {
    // ignore version if they are editing; default to 'published'
    if (!_.get(res, 'req.query.edit')) {
      uri = clayUtils.replaceVersion(uri, uri.split('@')[1] || 'published');
    }

    return fn(uri, req, res, hrStart);
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
module.exports.renderDynamicRoute = renderDynamicRoute;
module.exports.formDataForRenderer = formDataForRenderer;

// Render Utils
module.exports.rendererExists = rendererExists;
module.exports.getExpressRoutePrefix = getExpressRoutePrefix;
module.exports.findRenderer = findRenderer;

// Setup
module.exports.renderers = {}; // Overriden when a user registers a render object
module.exports.registerRenderers = registerRenderers;

// For Testing
module.exports.resetUriRouteHandlers = resetUriRouteHandlers;
module.exports.setUriRouteHandlers = setUriRouteHandlers;
module.exports.assumePublishedUnlessEditing = assumePublishedUnlessEditing;
module.exports.setDb = mock => db = mock;
module.exports.setLog = mock => log = mock;
