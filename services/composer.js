/**
 * Handles all template-rendering functionality.
 *
 * @module
 */

'use strict';
var log = require('./log'),
  siteService = require('./sites'),
  nunjucks = require('nunjucks-filters')(),
  multiplex = require('multiplex-templates')({nunjucks: nunjucks}),
  db = require('./db'),
  references = require('./references'),
  schema = require('./schema'),
  _ = require('lodash'),
  chalk = require('chalk'),
  ignoreDataProperty = 'ignore-data',
  assertions = require('./assertions');

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
    assertions.exists(data.template, 'data.template');

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

  //assertions
  assertions.exists(res.locals, 'res.locals');
  assertions.exists(res.locals.site, 'res.locals.site');
  assertions.isObject(options.data, 'options.data');
  assertions.exists(options.data.template, 'options.data.template');

  return schema.resolveDataReferences(options.data)
    .then(applyOptions(options, res))
    .then(renderTemplate());
}

/**
 * Given a component reference of the form /components/<name> or /components/<name>/instances/<id>, render that component.
 *
 * @param {string} componentReference
 * @param res
 * @param {{}} [options]
 * @returns {Promise}
 */
function renderComponent(componentReference, res, options) {
  options = options || {};
  var componentName = schema.getComponentNameFromPath(componentReference);

  //assertions
  //assertions
  assertions.exists(res.locals, 'res.locals');
  assertions.exists(res.locals.site, 'res.locals.site');
  assertions.exists(componentName, 'component name');

  return references.getComponentData(componentReference, res.locals)
    .then(function (data) {
      //assertions
      assertions.isObject(data);

      //apply rule: data.template > componentName
      //  If there is a template mentioned in the data, assume they know what they're doing
      data.template = data.template || componentName;
      options.data = data;
      return renderByConfiguration(options, res);
    });
}

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
  return db.get(pageReference)
    .then(JSON.parse)
    .then(function (result) {

      var layoutReference = result.layout,
        layoutComponentName = schema.getComponentNameFromPath(layoutReference),
        pageData = _.omit(result, 'layout');

      if (!layoutReference || !layoutComponentName) {
        throw new Error('Page is missing layout: ' + pageReference + ' ' + result + ' ' + JSON.stringify(result));
      }

      return references.getComponentData(layoutReference)
        .then(mapLayoutToPageData.bind(this, pageData))
        .then(function (result) {
          var options = { data: result };
          options.data.template = layoutComponentName;
          return renderByConfiguration(options, res);
        });
    });
}

module.exports = function (req, res) {
  var urlWithoutQuerystring = req.url.split('?').shift(),
    pageReference = '/pages/' + new Buffer(req.vhost.hostname + urlWithoutQuerystring).toString('base64');

  renderPage(pageReference, res)
    .then(function (html) {
      res.send(html);
    }).catch(function (err) {
      log.warn(req.vhost.hostname + req.url + '\n' + chalk.dim(err.stack));
    });
};

module.exports.renderPage = renderPage;
module.exports.renderComponent = renderComponent;