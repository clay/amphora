'use strict';

var uriRoutes, renderers;
const _ = require('lodash'),
  bluebird = require('bluebird'),
  media = require('./media'),
  schema = require('./schema'),
  files = require('./files'),
  control = require('./control'),
  components = require('./services/components'),
  references = require('./services/references'),
  db = require('./services/db'),
  log = require('./services/log').withStandardPrefix(__filename),
  composer = require('./services/composer'),
  mapLayoutToPageData = require('./utils/layout-to-page-data');

/**
 * [getExtension description]
 * @param  {[type]} req [description]
 * @return [type]       [description]
 */
function getExtension(req) {
  return _.get(req, 'params.ext', '') ? req.params.ext.toLowerCase() : renderers.default;
}

/**
 * [registerRenderers description]
 * @param  {[type]} renderers [description]
 * @return [type]             [description]
 */
function registerRenderers(renderObj) {
  renderers = renderObj;
  // Export the renderers object
  module.exports.renderers = renderers;
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
 * Add state to result, which adds functionality and information about this request to the templates.
 * @param {object} options
 * @param {object} res
 * @returns {Function}
 */
function applyOptions(options, locals) {
  return function (result) {
    let state, { site } = locals, componentList;

    // options are done at this point; now mix with the data and bind into a self-referencing chain of globals
    state = {
      site,
      locals,
      getTemplate: _.partialRight(components.getTemplate, 'template') // TODO: Required by Nunjucks. Remove once we get to all handlebars
    };

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
    transfer(options, state, 'layout', '_layout');
    transfer(options, state, 'layoutRef', '_layoutRef'); // TODO: collapse layoutRef and pageRef into the same prop name?

    // can't assign to result, or we'd get a circular reference in refs.
    _.set(state, '_components', componentList);
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

    // the circle of life: self-reference; freeze everything; rule a frozen wasteland
    // control.setDeepObjectTypesReadOnly(state);
    // state.state = state;

    return state;
  };
}


/**
 * [determineRenderer description]
 * @return [type] [description]
 */
function findRenderer(extension) {
  var renderer;

  // Default to HTML if you don't have an extension
  extension = extension;
  // Get the renderer
  renderer = _.get(renderers, `${extension}`, null);

  if (renderer) {
    return renderer;
  } else {
    throw new Error(`Renderer not found for extension ${extension}`);
  }
}

/**
 * [renderComponent description]
 * @param  {[type]} req     [description]
 * @param  {[type]} res     [description]
 * @param  {[type]} options [description]
 * @return [type]           [description]
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
 * [getDBObject description]
 * @param  {[type]} uri [description]
 * @return [type]       [description]
 */
function getDBObject(uri) {
  return db.get(uri).then(JSON.parse);
}

/**
 * [renderPage description]
 * @param  {[type]} req [description]
 * @param  {[type]} res [description]
 * @return [type]       [description]
 */
function renderPage(uri, req, res) {
    const locals = res.locals,
    extension = getExtension(req),
    renderer = findRenderer(extension);

  // look up page alias' component instance
  return getDBObject(uri)
    .then(function (result) {
      const layoutReference = result.layout,
        layoutComponentName = components.getName(layoutReference),
        pageData = references.omitPageConfiguration(result);

      return components.get(layoutReference)
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
          return formDataForRenderer(options, locals)
            .then(renderer.render);
        });
    });
}

/**
 * [formDataForRenderer description]
 * @param  {[type]} options [description]
 * @param  {[type]} locals  [description]
 * @return [type]           [description]
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
        newUri = new Buffer(newBase64Uri, 'base64').toString('utf8'),
        newPath = url.parse(`${res.req.protocol}://${newUri}`).path,
        newUrl = `${res.req.protocol}://${res.req.hostname}${newPath}`;

      log('info', 'Redirecting to ' + newUrl);
      res.redirect(301, newUrl);
    } else {
      return route.default(result, req, res);
    }
  });
}


/**
 * Run composer by translating url to a "page" by base64ing it.  Errors are handled by Express.
 *
 * NOTE: Does not return a promise ON PURPOSE.  This function is express-style.
 *
 * @param {object} req
 * @param {object} res
 * @param {function} next
 */
function renderExpressRoute(req, res, next) {
  var hrStart = process.hrtime(),
    site = res.locals.site,
    prefix = `${getExpressRoutePrefix(site)}/uris/`,
    pageReference = `${prefix}${new Buffer(req.hostname + req.baseUrl + req.path).toString('base64')}`;


  renderUri(pageReference, req, res).then((resp) => {
    if (resp) {
      // if we're rendering a route normally, there will be content to sent back
      // if it hits a redirect, there will be nothing here (and we shouldn't try to
      // send headers after the redirect has fired)
      res.type(resp.type);
      res.send(resp.output);

      const diff = process.hrtime(hrStart),
        ms = Math.floor((diff[0] * 1e9 + diff[1]) / 1000000);

      log('info', 'rendered express route:' + (req.hostname + req.baseUrl + req.path) + ' ' + ms + 'ms');
    }
  }).catch((error) => {
    if (error.name === 'NotFoundError') {
      log('verbose', 'in', req.uri, error.message);
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
      uri = references.replaceVersion(uri, uri.split('@')[1] || 'published');
    }

    return fn(uri, req, res);
  };
}

/**
 * [rendererExists description]
 * @param  {[type]} extension [description]
 * @return [type]             [description]
 */
function rendererExists(extension) {
  return _.get(renderers, `[${extension}]`, false);
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
      when: /\/pages\//,
      default: assumePublishedUnlessEditing(renderPage),
      json: assumePublishedUnlessEditing(getDBObject)
    },
    // assume published
    {
      when: /\/components\//,
      default: assumePublishedUnlessEditing(renderComponent),
      json: assumePublishedUnlessEditing(components.get)
    },
    // uris are not published, they only exist
    {
      when: /\/uris\//,
      isUri: true,
      html: renderUri, // TODO: Rename to default?
      json: db.get
    }];
}

resetUriRouteHandlers();

// Rendering
module.exports = renderExpressRoute;
module.exports.renderComponent = renderComponent;
module.exports.renderPage = renderPage;

// Render Utils
module.exports.rendererExists = rendererExists;

// Setup
module.exports.renderers = {}; // Overriden when a user registers a render object
module.exports.registerRenderers = registerRenderers;
