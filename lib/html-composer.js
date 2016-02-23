/**
 * Handles all template-rendering functionality.
 *
 * @module
 */

'use strict';

var uriRoutes, multiplex;
const _ = require('lodash'),
  components = require('./services/components'),
  control = require('./control'),
  db = require('./services/db'),
  log = require('./log').withStandardPrefix(__filename),
  multiplexTemplates = require('multiplex-templates'),
  references = require('./services/references'),
  composer = require('./composer'),
  media = require('./media'),
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
 * add params to res.locals
 * @param {object} res
 * @returns {object}
 */
function addParams(res) {
  const req = res.req;

  return _.assign(res.locals, req.params, req.query);
}

/**
 * Only assign if exists in from, and if does not exist in to; also: allow rename.
 * @param from
 * @param to
 * @param fromProp
 * @param [toProp]
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
 * @param options
 * @param res
 * @returns {Function}
 */
function applyOptions(options, res) {
  return function (result) {
    var state, site, locals, componentList;

    site = res.locals.site;
    locals = res.locals;

    // if the data has any of these already, do not overwrite them!
    transfer(options, result, 'template');
    transfer(options, result, 'ref', '_self');
    transfer(options, result, 'pageRef', '_self');
    transfer(options, result, 'pageData', '_pageData');
    transfer(options, result, 'version', '_version');
    transfer(options, result, 'layout', '_layout');

    componentList = addComponentList(options.layoutRef || options.ref, result);

    if (componentList.length) {
      media.addMediaMap(componentList, result, locals);
    }

    // options are done at this point; now mix with the data and bind into a self-referencing chain of globals
    state = {
      site: site,
      locals: locals,
      getTemplate: _.partialRight(components.getTemplate, 'template')
    };

    // can't assign to result, or we'd get a circular reference in refs.
    _.set(state, '_components', componentList);

    // the circle of life: self-reference; freeze everything; rule a frozen wasteland
    _.assign(state, result);
    control.setDeepObjectTypesReadOnly(state);
    state.state = state;

    return state;
  };
}

/**
 * Render a template based on some generic data provided.
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
 * @param res
 * @param {object} res.locals
 * @returns {Promise}
 */
function renderByConfiguration(options, res) {
  // resolving components sometimes needs params for their server.js's
  addParams(res);

  return composer.resolveComponentReferences(options.data, res.locals)
    .then(applyOptions(options, res))
    .then(renderTemplate());
}

/**
 * Given a component reference of the form /components/<name> or /components/<name>/instances/<id>, render that component.
 *
 * @param {string} uri
 * @param res
 * @param {{}} [options]  Optional parameters for rendering
 * @returns {Promise}
 */
function renderComponent(uri, res, options) {
  options = options || {};

  var componentName = components.getName(uri);

  return components.get(uri, res.locals)
    .then(function (data) {
      // apply rule: data.template > componentName
      //  If there is a template mentioned in the data, assume they know what they're doing
      options.version = options.version || uri.split('@')[1];
      data.template = data.template || componentName;
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
 * Clear and replace original list with items in-place (which may have different length than original)
 *
 * @param {Array} list  Array to clear and replace
 * @param {Array} items  Items to put into the list.
 */
function replaceItems(list, items) {
  list.length = 0;
  list.push.apply(list, items);
}

/**
 * Takes a component list from the layout data and merges it with data from the page.
 *
 * NOTE: The end result may be longer (or shorter!) than the original list.
 *
 * @param {Array} list
 * @param {object} pageData
 */
function reducePageDataIntoLayoutComponentList(list, pageData) {
  return _.reduce(list, function (items, item) {
    var pageItem;

    // if there is a string, try to find a match
    if (_.isString(item)) {
      pageItem = pageData[item];

      if (pageItem) {
        // if there is a match, assign whatever matches in pageData as a reference
        if (_.isString(pageItem)) {
          items.push(refToObj(pageItem));
        } else if (_.isArray(pageItem)) {
          items = items.concat(_.map(pageItem, refToObj));
        } else {
          // if it's an object or boolean, they're doing something weird
          log('warn', 'data is not a reference in layout:', item, pageData, list);
        }
      } else {
        // if there is no match, that's a problem with configuration/editing
        log('warn', 'missing reference in layout:', item, pageData, list);
      }
    } else {
      items.push(item);
    }

    return items;
  }, []);
}

/**
 * Maps strings in arrays of layoutData into the properties of pageData
 * @param {object} pageData
 * @param {object} layoutData
 * @returns {*}
 */
function mapLayoutToPageData(pageData, layoutData) {
  var lists = _.listDeepObjects(layoutData, _.isArray);

  _.each(lists, function (list) {
    replaceItems(list, reducePageDataIntoLayoutComponentList(list, pageData));
  });

  return layoutData;
}

/**
 * Given a page reference of the form /pages/<pagename>, lookup the alias and render that component
 * @param {string} uri
 * @param res
 * @returns Promise
 * @example renderPage('/pages/bG9jYWxob3N0LnZ1bHR1cmUuY29tL2Zhdmljb24uaWNv', res);
 */
function renderPage(uri, res) {
  // look up page alias' component instance
  return getDBObject(uri)
    .then(function (result) {
      var layoutReference = result.layout,
        layoutComponentName = components.getName(layoutReference),
        pageData = references.omitPageConfiguration(result);

      return components.get(layoutReference)
        .then(mapLayoutToPageData.bind(this, pageData))
        .then(function (result) {
          var options = {data: result};
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
 * @param res
 * @returns Promise
 */
function renderUri(uri, res) {
  return db.get(uri).then(function (result) {
    const route = _.find(uriRoutes, function (item) {
      return result.match(item.when);
    });

    if (route) {
      return route.html(result, res);
    } else {
      throw new Error('Invalid URI: ' + uri + ': ' + result);
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
  var prefix = site.host;

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
 * @param req
 * @param res
 * @param {function} next
 */
function renderExpressRoute(req, res, next) {
  var site, prefix, pageReference, hrStart;

  hrStart = process.hrtime();
  site = res.locals.site;
  prefix = getExpressRoutePrefix(site) + '/uris/';
  pageReference = prefix + new Buffer(req.hostname + req.baseUrl + req.path).toString('base64');

  renderUri(pageReference, res).then(function (html) {
    res.type('html');
    res.send(html);

    const diff = process.hrtime(hrStart),
      ms = Math.floor((diff[0] * 1e9 + diff[1]) / 1000000);
    log('info', 'rendered express route:' + (req.hostname + req.baseUrl + req.path) + ' ' + ms + 'ms');
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
 * @param value
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
