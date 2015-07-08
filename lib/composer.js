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
  _ = require('lodash'),
  chalk = require('chalk'),
  ignoreDataProperty = 'ignore-data',
  components = require('./services/components');

/**
 * Find all _ref, and recursively expand them.
 *
 * TODO: schema validation here
 * @param {object} data
 * @param {string} version
 * @returns {Promise}
 */
function resolveDataReferences(data, version) {
  var referenceProperty = '_ref',
    placeholders = _.listDeepObjects(data, referenceProperty);

  return bluebird.all(placeholders).each(function (placeholder) {
    var promise,
      ref = placeholder[referenceProperty],
      handler = _.find(uriRoutes, function (item) { return ref.match(item.when); });

    if (handler && _.isFunction(handler.json)) {
      // replace original with parent version
      placeholder[referenceProperty] = references.replaceVersion(placeholder[referenceProperty], version);
      promise = handler.json(placeholder[referenceProperty]);
    } else {
      promise = fetch(ref).then(function (result) { return result.json(); });
    }

    return promise.then(function (obj) {
        // the thing we got back might have its own references
        return resolveDataReferences(obj, version).finally(function () {
          _.assign(placeholder, _.omit(obj, referenceProperty));
        });
      });
  }).return(data);
}

/**
 * Add state to result, which adds functionality and information about this request to the templates.
 * @param options
 * @param res
 * @returns {Function}
 */
function applyOptions(options, res) {
  return function (result) {
    var state,
      site = siteService.sites()[res.locals.site],
      locals = res.locals;

    // remove all the properties mentioned here
    if (options[ignoreDataProperty]) {
      // todo: Maybe allow deep-has omiting i.e., ignore-data=story.some.thing,story.thing
      result = _.omit(result, options[ignoreDataProperty]);
    }

    // apply rule:  options.template > result.template
    if (options.template) {
      result.template = options.template;
    }

    // report the end result of what we've done
    log.info(chalk.dim('serving ' + require('util').inspect(result, true, 5)));

    // options are done at this point; now mix with the data and bind into a self-referencing chain of globals
    state = {
      site: site,
      locals: locals,
      getTemplate: components.getTemplate
    };

    // the circle of life;  this is equivalent to what was here before.
    _.assign(state, result);
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

    return multiplex.render(template, data);
  };
}

/**
 *
 * @param {{data: {template: string}}} options
 * @param res
 * @returns {Promise}
 */
function renderByConfiguration(options, res) {
  return resolveDataReferences(options.data, options.version)
    .then(applyOptions(options, res))
    .then(renderTemplate());
}

/**
 * Given a component reference of the form /components/<name> or /components/<name>/instances/<id>, render that component.
 *
 * @param {string} ref
 * @param res
 * @param {{}} [options]  Optional parameters for rendering
 * @returns {Promise}
 */
function renderComponent(ref, res, options) {
  options = options || {};
  options.version = options.version || ref.split('@')[1];

  var componentName = components.getName(ref);

  return components.get(ref, res.locals)
    .then(function (data) {
      // apply rule: data.template > componentName
      //  If there is a template mentioned in the data, assume they know what they're doing
      data.template = data.template || componentName;
      options.data = data;
      return renderByConfiguration(options, res);
    });
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
    _.each(list, function (item, index, list) {
      // if there is a string, try to find a match
      if (_.isString(item)) {
        if (pageData[item]) {
          // if there is a match, assign whatever matches in pageData as a reference
          list[index] = {
            _ref: pageData[item]
          };
        } else {
          // if there is no match, that's a problem with configuration/editing
          log.warn('Missing reference in layout: ', item, pageData, layoutData);
        }
      }
    });
  });
  return layoutData;
}

/**
 * Given a page reference of the form /pages/<pagename>, lookup the alias and render that component
 * @param {string} ref
 * @param res
 * @returns Promise
 * @example renderPage('/pages/bG9jYWxob3N0LnZ1bHR1cmUuY29tL2Zhdmljb24uaWNv', res);
 */
function renderPage(ref, res) {

  // ignore version if they are editing; default to 'published'
  if (res.req.query.edit && ref.split('@')[1]) {
    throw new Error('Client: Cannot edit versioned page.');
  }

  // look up page alias' component instance
  return db.get(ref)
    .then(JSON.parse)
    .then(function (result) {
      var layoutReference = result.layout,
        layoutComponentName = components.getName(layoutReference),
        pageData = _.omit(result, 'layout');

      return components.get(layoutReference)
        .then(mapLayoutToPageData.bind(this, pageData))
        .then(function (result) {
          var options = { data: result };
          options.version = ref.split('@')[1];
          options.data.template = layoutComponentName;
          return renderByConfiguration(options, res);
        });
    });
}

/**
 * Redirect to referenced type.
 *
 * Depending on what the uri references, load something different.
 *
 * @param {string} ref
 * @param res
 * @returns Promise
 */
function renderUri(ref, res) {
  return db.get(ref)
    .then(function (result) {
      var route = _.first(uriRoutes, function (item) {
        return result.match(item.when);
      });

      if (route) {
        return route.handler(result, res);
      } else {
        throw new Error('Invalid URI: ' + ref + ': ' + result);
      }
    });
}

function setUriRouteHandlers(routes) {
  uriRoutes = routes;
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
function composer(req, res, next) {
  var urlWithoutQuerystring = req.url.split('?').shift(),
    pageReference = '/uris/' + new Buffer(req.vhost.hostname + urlWithoutQuerystring).toString('base64');

  renderUri(pageReference, res)
    .then(function (html) {
      res.type('html');
      res.send(html);
    }).catch(function (err) {
      next(err);
    });
}


/**
 * URIs can point to many different things, and this list will probably grow.
 * @type {[{when: RegExp, handler: Function}]}
 */
uriRoutes = [
  {
    when: /^\/pages\//,
    handler: function (ref, res) {

      // ignore version if they are editing; default to 'published'
      if (!res.req.query.edit) {
        ref = references.replaceVersion(ref, ref.split('@')[1] || 'published');
      }

      return renderPage(ref, res);
    },
    json: function (ref) { return db.get(ref).then(JSON.parse); }
  }, {
    when: /^\/components\//,
    handler: renderComponent,
    json: components.get
  }, {
    when: /^\/uris\//,
    handler: renderUri,
    json: db.get
  }];


module.exports = composer;
module.exports.renderUri = renderUri;
module.exports.renderPage = renderPage;
module.exports.renderComponent = renderComponent;

// for testing (or maybe from a config later?)
module.exports.setUriRouteHandlers = setUriRouteHandlers;
module.exports.resolveDataReferences = resolveDataReferences;
