/**
 * Handles all template-rendering functionality.
 *
 * @module
 */

'use strict';
var uriRoutes,
  log = require('./log'),
  siteService = require('./sites'),
  nunjucks = require('nunjucks-filters')(),
  multiplex = require('multiplex-templates')({nunjucks: nunjucks}),
  db = require('./services/db'),
  references = require('./services/references'),
  bluebird = require('bluebird'),
  fetch = require('node-fetch'),
  media = require('./media'),
  _ = require('lodash'),
  chalk = require('chalk'),
  ignoreDataProperty = 'ignore-data',
  components = require('./services/components'),
  control = require('./control');

/**
 * Find all _ref, and recursively expand them.
 *
 * @param {object} data
 * @param {function|string} [filter='_ref']
 * @returns {Promise}
 */
function resolveDataReferences(data, filter) {
  var referenceProperty = '_ref',
    referenceObjects = _.listDeepObjects(data, filter || referenceProperty);

  return bluebird.all(referenceObjects).each(function (placeholder) {
    var promise,
      ref = placeholder[referenceProperty],
      handler = _.find(uriRoutes, function (item) { return ref.match(item.when); });

    if (handler && _.isFunction(handler.json)) {
      promise = handler.json(placeholder[referenceProperty]);
    } else {
      promise = fetch(ref).then(function (result) { return result.json(); });
    }

    return promise.then(function (obj) {
        // the thing we got back might have its own references
        return resolveDataReferences(obj, filter).finally(function () {
          _.assign(placeholder, _.omit(obj, referenceProperty));
        });
      });
  }).return(data);
}

/**
 * add params to res.locals
 * @param {object} res
 * @returns {object}
 */
function addParams(res) {
  var req = res.req;

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
 * Add state to result, which adds functionality and information about this request to the templates.
 * @param options
 * @param res
 * @returns {Function}
 */
function applyOptions(options, res) {
  return function (result) {
    var state, site, locals, indices;

    addParams(res);
    site = siteService.sites()[res.locals.site];
    locals = res.locals;

    // remove all the properties mentioned here
    if (options[ignoreDataProperty]) {
      // todo: Maybe allow deep-has omiting i.e., ignore-data=story.some.thing,story.thing
      result = _.omit(result, options[ignoreDataProperty]);
    }

    // its okay for data to have a template; isn't that neat?
    transfer(options, result, 'template');

    if (options.ref) {
      // don't assume ref exists; be kind
      transfer(options, result, 'ref', '_self');
      indices = components.getIndices(options.ref, result);
    }

    transfer(options, result, 'ref', '_self');
    transfer(options, result, 'pageRef', '_self');
    transfer(options, result, 'pageData', '_pageData');
    transfer(options, result, 'version', '_version');
    transfer(options, result, 'layout', '_layout');

    // report the end result of what we've done
    log.info(chalk.dim('serving ' + require('util').inspect(result, true, 10)));

    // options are done at this point; now mix with the data and bind into a self-referencing chain of globals
    state = {
      site: site,
      locals: locals,
      getTemplate: components.getTemplate
    };

    // can't assign to result, or we'd get a circular reference in refs.
    _.assign(state, indices);

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
    var template = components.getTemplate(data.template);

    if (!template) {
      throw new Error('Missing template for ' + JSON.stringify(_.omit(data, 'state')));
    }

    return Promise.resolve(multiplex.render(template, data))
      .then(media.appendTop(data))
      .then(media.appendBottom(data));
  };
}

/**
 *
 * @param {{data: {template: string}}} options
 * @param res
 * @returns {Promise}
 */
function renderByConfiguration(options, res) {
  return resolveDataReferences(options.data)
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
  return { _ref: ref };
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
          log.warn('Data is not a reference in layout: ', item, pageData, list);
        }
      } else {
        // if there is no match, that's a problem with configuration/editing
        log.warn('Missing reference in layout: ', item, pageData, list);
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

  // ignore version if they are editing; default to 'published'
  if (res.req.query.edit && uri.split('@')[1]) {
    throw new Error('Client: Cannot edit versioned page.');
  }

  // look up page alias' component instance
  return db.get(uri)
    .then(JSON.parse)
    .then(function (result) {
      var layoutReference = result.layout,
        layoutComponentName = components.getName(layoutReference),
        pageData = _.omit(result, 'layout');

      return components.get(layoutReference)
        .then(mapLayoutToPageData.bind(this, pageData))
        .then(function (result) {
          var options = { data: result };
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
  return db.get(uri)
    .then(function (result) {
      var route = _.find(uriRoutes, function (item) {
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
  var site, prefix, pageReference;

  if (!res.locals || !res.locals.site) {
    // site information is required; error is express-style
    next(new Error('Missing site (res.locals.site)'));
    return;
  }

  site = siteService.sites()[res.locals.site];
  if (!site) {
    // site information is required; error is express-style
    next(new Error('Site does not exist: ' + res.locals.site));
    return;
  }

  prefix = getExpressRoutePrefix(site) + '/uris/';
  pageReference = prefix + new Buffer(req.hostname + req.baseUrl + req.path).toString('base64');

  renderUri(pageReference, res)
    .then(function (html) {
      res.type('html');
      res.send(html);
    }).catch(function (err) {
      next(err);
    });
}

/**
 * @param value
 */
function setUriRouteHandlers(value) {
  uriRoutes = value;
}

/**
 * Internal function to get data
 * @param uri
 * @returns {Promise.object}
 */
function getPageData(uri) {
  return db.get(uri).then(JSON.parse);
}

/**
 * Reset our route handlers back to the standard.
 *
 * NOTE: Our default route handlers are defined here.
 */
function resetUriRouteHandlers() {
  /**
   * URIs can point to many different things, and this list will probably grow.
   * @type {[{when: RegExp, html: function, json: function}]}
   */
  uriRoutes = [
    {
      when: /\/pages\//,
      html: function (uri, res) {

        // ignore version if they are editing; default to 'published'
        if (!res.req.query.edit) {
          uri = references.replaceVersion(uri, uri.split('@')[1] || 'published');
        }

        return renderPage(uri, res);
      },
      json: getPageData
    }, {
      when: /\/components\//,
      html: renderComponent,
      json: components.get
    }, {
      when: /\/uris\//,
      html: renderUri,
      json: db.get
    }];
}

resetUriRouteHandlers();

module.exports = renderExpressRoute;
module.exports.renderUri = renderUri;
module.exports.renderPage = renderPage;
module.exports.renderComponent = renderComponent;

// for testing (or maybe from a config later?)
module.exports.setUriRouteHandlers = setUriRouteHandlers;
module.exports.resetUriRouteHandlers = resetUriRouteHandlers;
module.exports.resolveDataReferences = resolveDataReferences;
