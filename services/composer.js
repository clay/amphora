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
  references = require('./references'),
  schema = require('./schema'),
  _ = require('lodash'),
  chalk = require('chalk'),
  ignoreDataProperty = 'ignore-data',
  is = require('./assert-is');

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

    //remove all the properties mentioned here
    if (options[ignoreDataProperty]) {
      //todo: Maybe allow deep-has omiting i.e., ignore-data=story.some.thing,story.thing
      result = _.omit(result, options[ignoreDataProperty]);
    }

    //apply rule:  options.template > result.template
    if (options.template) {
      result.template = options.template;
    }

    //report the end result of what we've done
    log.info(chalk.dim('serving ' + require('util').inspect(result, true, 5)));

    //options are done at this point; now mix with the data and bind into a self-referencing chain of globals
    state = {
      site: site,
      locals: locals,
      getTemplate: references.getTemplate
    };

    //the circle of life;  this is equivalent to what was here before.
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
    //assertions
    is(data.template, 'data.template');

    return multiplex.render(references.getTemplate(data.template), data);
  };
}

/**
 *
 * @param {{data: {template: string}}} options
 * @param res
 * @returns {Promise}
 */
function renderByConfiguration(options, res) {
  //assertions (Note: since this function isn't an entry point, maybe we can remove these assertions?)
  is(res.locals, 'res.locals');
  is(res.locals.site, 'res.locals.site');
  is.object(options.data, 'options.data');
  is.string(options.data.template, 'options.data.template');

  return schema.resolveDataReferences(options.data)
    .then(applyOptions(options, res))
    .then(renderTemplate());
}

/**
 * Given a component reference of the form /components/<name> or /components/<name>/instances/<id>, render that component.
 *
 * @param {string} componentReference
 * @param res
 * @param {{}} [options]  Optional parameters for rendering
 * @returns {Promise}
 */
function renderComponent(componentReference, res, options) {
  options = options || {};
  
  //assertions
  is(res.locals, 'res.locals');
  is(res.locals.site, 'res.locals.site');
  is(componentReference, 'component reference');
  var componentName = is(references.getComponentName(componentReference), 'component name');

  return references.getComponentData(componentReference, res.locals)
    .then(function (data) {
      //assertions
      is.object(data);

      //apply rule: data.template > componentName
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
      //if there is a string, try to find a match
      if (_.isString(item)) {
        if (pageData[item]) {
          //if there is a match, assign whatever matches in pageData as a reference
          list[index] = {
            _ref: pageData[item]
          };
        } else {
          //if there is no match, that's a problem with configuration/editing
          log.warn('Missing reference in layout: ', item, pageData, layoutData)
        }
      }
    });
  });
  return layoutData;
}


/**
 * Given a page reference of the form /pages/<pagename>, lookup the alias and render that component
 * @param {string} pageReference
 * @param res
 * @returns {Promise}
 * @example renderPage('/pages/bG9jYWxob3N0LnZ1bHR1cmUuY29tL2Zhdmljb24uaWNv', res);
 */
function renderPage(pageReference, res) {
  //look up page alias' component instance
  return references.getPageData(pageReference)
    .then(function (result) {

      var layoutReference = result.layout,
        layoutComponentName = references.getComponentName(layoutReference),
        pageData = _.omit(result, 'layout');

      is(layoutReference, 'layout reference in page data');
      is(layoutComponentName, 'layout component name from page data');

      return references.getComponentData(layoutReference)
        .then(mapLayoutToPageData.bind(this, pageData))
        .then(function (result) {
          var options = { data: result };
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
 * @param {string} uriReference
 * @param res
 * @returns {Promise}
 */
function renderUri(uriReference, res) {
  return references.getUriData(uriReference)
    .then(function (result) {
      var route = _.first(uriRoutes, function (item) {
        return result.match(item.when);
      });

      if (route) {
        route.handler(result, res);
      } else {
        throw new Error('Invalid URI: ' + uriReference + ': ' + result);
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
 * @param next
 */
function composer(req, res, next) {
  var urlWithoutQuerystring = req.url.split('?').shift(),
    pageReference = '/uris/' + new Buffer(req.vhost.hostname + urlWithoutQuerystring).toString('base64');

  renderUri(pageReference, res)
    .then(function (html) {
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
  { when: /^\/pages\//, handler: renderPage },
  { when: /^\/components\//, handler: renderComponent },
  { when: /^\/uris\//, handler: renderUri }
];


module.exports = composer;
module.exports.renderUri = renderUri;
module.exports.renderPage = renderPage;
module.exports.renderComponent = renderComponent;

//for testing (or maybe from a config later?)
module.exports.setUriRouteHandlers = setUriRouteHandlers;