/**
 * Handles all template-rendering functionality.
 *
 * @module
 */

'use strict';

let uriRoutes, multiplex;
const _ = require('lodash'),
  components = require('./services/components'),
  control = require('./control'),
  db = require('./services/db'),
  log = require('./services/log').withStandardPrefix(__filename),
  multiplexTemplates = require('multiplex-templates'),
  references = require('./services/references'),
  composer = require('./services/composer'),
  schema = require('./schema'),
  files = require('./files'),
  media = require('./media'),
  url = require('url'),
  defaultHtmlTemplateName = 'template';

/**
 * Internal function to get data
 * @param {string} uri
 * @returns {Promise}
 */
function getDBObject(uri) {
  return db.get(uri).then(JSON.parse);
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
 *
 * @param {string} ref
 * @param {object} data
 * @returns {[string]}
 */
function addComponentList(ref, data) {
  const indices = components.getIndices(ref, data),
    componentList = indices && indices.components || [];

  _.set(data, '_components', componentList);

  return componentList;
}

/**
 * Add state to result, which adds functionality and information about this request to the templates.
 * @param {object} options
 * @param {object} res
 * @returns {Function}
 */
function applyOptions(options, res) {
  return function (result) {
    let state, site, locals, componentList;

    site = res.locals.site;
    locals = res.locals;

    // if the data has any of these already, do not overwrite them!
    transfer(options, result, 'template');
    transfer(options, result, 'ref', '_self');
    transfer(options, result, 'pageRef', '_self');
    transfer(options, result, 'pageData', '_pageData');
    transfer(options, result, 'version', '_version');
    transfer(options, result, 'layout', '_layout');
    transfer(options, result, 'layoutRef', '_layoutRef');

    componentList = addComponentList(options.layoutRef || options.ref, result);

    if (componentList.length) {
      media.addMediaMap(componentList, result, locals);
    }

    // options are done at this point; now mix with the data and bind into a self-referencing chain of globals
    state = {
      site,
      locals,
      getTemplate: _.partialRight(components.getTemplate, 'template')
    };

    // can't assign to result, or we'd get a circular reference in refs.
    _.set(state, '_components', componentList);
    _.set(state, '_componentSchemas', _.map(componentList, function (name) {
      return {
        name: name,
        schema: schema.getSchemaPath(files.getComponentPath(name))
      };
    }));

    // the circle of life: self-reference; freeze everything; rule a frozen wasteland
    _.assign(state, result);
    control.setDeepObjectTypesReadOnly(state);
    state.state = state;

    return state;
  };
}

/**
 * Render a template based on some generic data provided.
 * @returns {Function}
 */
function renderTemplate() {
  return function (data) {
    const template = components.getTemplate(data.template, defaultHtmlTemplateName);

    if (!template) {
      throw new Error('Missing template for ' + data.template);
    }

    return Promise.resolve(multiplex.render(template, data))
      .then(media.append(data));
  };
}

/**
 *
 * @param {object} options
 * @param {{template: string}} options.data
 * @param {object} res
 * @param {object} res.locals
 * @returns {Promise}
 */
function renderByConfiguration(options, res) {
  return composer.resolveComponentReferences(options.data, res.locals)
    .then(applyOptions(options, res))
    .then(renderTemplate());
}

/**
 * Given a component reference of the form /components/<name> or /components/<name>/instances/<id>, render that component.
 *
 * @param {string} uri
 * @param {object} res
 * @param {{}} [options]  Optional parameters for rendering
 * @returns {Promise}
 */
function renderComponent(uri, res, options) {
  options = options || {};

  return components.get(uri, res.locals)
    .then(function (data) {
      // apply rule: data.template > componentName
      //  If there is a template mentioned in the data, assume they know what they're doing
      options.version = options.version || uri.split('@')[1];
      data.template = data.template || components.getName(uri);
      options.data = data;
      options.ref = uri;

      return renderByConfiguration(options, res);
    });
}

/**
 * @param {string} ref
 * @returns {{_ref: string}}
 */
function refToObj(ref) {
  return {_ref: ref};
}

/**
 * Maps strings in arrays of layoutData into the properties of pageData
 * @param {object} pageData
 * @param {object} layoutData
 * @returns {*}
 */
function mapLayoutToPageData(pageData, layoutData) {
  // quickly (and shallowly) go through the layout's properties,
  // finding strings that map to page properties
  _.each(layoutData, function (list, key) {
    if (_.isString(list)) {
      if ( _.isArray(pageData[key])) {
        // if you find a match and the data exists,
        // replace the property in the layout data
        layoutData[key] = _.map(pageData[key], refToObj);
      } else {
        // otherwise replace it with an empty list
        // as all layout properties are component lists
        layoutData[key] = [];
      }
    }
  });

  return layoutData;
}

/**
 * Given a page reference of the form /pages/<pagename>, lookup the alias and render that component
 * @param {string} uri
 * @param {object} res
 * @returns {Promise}
 * @example renderPage('/pages/bG9jYWxob3N0LnZ1bHR1cmUuY29tL2Zhdmljb24uaWNv', res);
 */
function renderPage(uri, res) {
  // look up page alias' component instance
  return getDBObject(uri)
    .then(function (result) {
      const layoutReference = result.layout,
        layoutComponentName = components.getName(layoutReference),
        pageData = references.omitPageConfiguration(result);

      return components.get(layoutReference)
        .then(mapLayoutToPageData.bind(this, pageData))
        .then(function (result) {
          const options = {data: result};

          options.version = uri.split('@')[1];
          options.data.template = layoutComponentName;
          options.pageRef = uri;
          options.pageData = pageData;
          options.layoutRef = layoutReference;
          options.ref = uri;
          return renderByConfiguration(options, res);
        });
    });
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
function renderUri(uri, res) {
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
      return route.html(result, res);
    }
  });
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
 * Run composer by translating url to a "page" by base64ing it.  Errors are handled by Express.
 *
 * NOTE: Does not return a promise ON PURPOSE.  This function is express-style.
 *
 * @param {object} req
 * @param {object} res
 * @param {function} next
 */
function renderExpressRoute(req, res, next) {
  let site, prefix, pageReference, hrStart;

  hrStart = process.hrtime();
  site = res.locals.site;
  prefix = getExpressRoutePrefix(site) + '/uris/';
  pageReference = prefix + new Buffer(req.hostname + req.baseUrl + req.path).toString('base64');

  renderUri(pageReference, res).then(function (html) {
    if (html) {
      // if we're rendering a route normally, there will be html to sent back
      // if it hits a redirect, there will be nothing here (and we shouldn't try to
      // send headers after the redirect has fired)
      res.type('html');
      res.send(html);

      const diff = process.hrtime(hrStart),
        ms = Math.floor((diff[0] * 1e9 + diff[1]) / 1000000);

      log('info', 'rendered express route:' + (req.hostname + req.baseUrl + req.path) + ' ' + ms + 'ms');
    }
  }).catch(function (error) {
    if (error.name === 'NotFoundError') {
      log('verbose', 'in', req.uri, error.message);
      next();
    } else {
      next(error);
    }
  });
}

/**
 * @param {*} value
 */
function setUriRouteHandlers(value) {
  uriRoutes = value;
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
  return function (uri, res) {
    // ignore version if they are editing; default to 'published'
    if (!_.get(res, 'req.query.edit')) {
      uri = references.replaceVersion(uri, uri.split('@')[1] || 'published');
    }

    return fn(uri, res);
  };
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
      html: assumePublishedUnlessEditing(renderPage),
      json: assumePublishedUnlessEditing(getDBObject)
    },
    // assume published
    {
      when: /\/components\//,
      html: assumePublishedUnlessEditing(renderComponent),
      json: assumePublishedUnlessEditing(components.get)
    },
    // uris are not published, they only exist
    {
      when: /\/uris\//,
      isUri: true,
      html: renderUri,
      json: db.get
    }];
}

/**
 * update the multiplex instance to use with engines specified by the project
 * @param {object} [engines]
 */
function addEngines(engines) {
  // set the multiplex instance
  multiplex = multiplexTemplates(engines);
}

addEngines();
resetUriRouteHandlers();

module.exports = renderExpressRoute;
module.exports.renderUri = renderUri;
module.exports.renderPage = renderPage;
module.exports.renderComponent = renderComponent;
module.exports.addEngines = addEngines;

// for testing (or maybe from a config later?)
module.exports.setUriRouteHandlers = setUriRouteHandlers;
module.exports.resetUriRouteHandlers = resetUriRouteHandlers;
module.exports.mapLayoutToPageData = mapLayoutToPageData;
module.exports.refToObj = refToObj;
