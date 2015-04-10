'use strict';
var config = require('config'),
  glob = require('glob'),
  log = require('./log'),
  siteService = require('./sites'),
  nunjucks = require('nunjucks-filters')(),
  multiplex = require('multiplex-templates')({nunjucks: nunjucks}),
  path = require('path'),
  db = require('./db'),
  files = require('./files'),
  schema = require('./schema'),
  _ = require('lodash'),
  chalk = require('chalk'),
  ignoreDataProperty = 'ignore-data',
  baseTemplateProperty = 'baseTemplate';  //configurable

/**
 * get full filename w/ extension
 * @param  {string} name e.g. "entrytext"
 * @return {string}          e.g. "components/entrytext/template.jade"
 */
function getTemplate(name) {
  // if there are slashes in this name, they've given us a reference like /components/name/instances/id
  if (name.indexOf('/') !== -1) {
    name = schema.getComponentNameFromPath(name);
  }

  var filePath = files.getComponentPath(name),
    possibleTemplates;

  if (_.contains(filePath, 'node_modules')) {
    possibleTemplates = [path.join(filePath, require(filePath + '/package.json').template)];
  } else {
    filePath = path.join(filePath, config.get('names.template'));
    possibleTemplates = glob.sync(filePath + '.*');
  }

  if (!possibleTemplates.length) {
    throw new Error('No template files found for ' + filePath);
  }

  // return the first template found
  return possibleTemplates[0];
}

/**
 * Add state to result, which adds functionality and information about this request to the templates.
 * @param state
 * @param options
 * @returns {Function}
 */
function addState(state, options) {
  return function (result) {

    //remove all the properties mentioned here
    if (options[ignoreDataProperty]) {
      //todo: Maybe allow deep-has omiting i.e., ignore-data=story.some.thing,story.thing
      result = _.omit(result, options[ignoreDataProperty]);
    }

    log.info(chalk.dim('serving ' + require('util').inspect(result, true, 5)));

    //the circle of life;  this is equivalent to what was here before.
    _.assign(state, result);
    state.state = state;

    return state;
  };
}

/**
 * calls server.js if it exists
 * @param {{}} state
 * @return {Promise|{}}
 */
function addDynamicState(state) {
  try {
    return require(path.join(files.getComponentPath(state.baseTemplate), 'server.js'))(state.locals.url, state);
  } catch (e) {
    // if there's no server.js, pass through state
    return state;
  }
}

/**
 * Render a template based on some generic data provided.
 *
 * Data should contain:
 *
 * {object} site - global information about the site being displayed
 * {string} baseTemplate - name of a component that has a template (some components may not, no assumptions)
 * {function} getTemplate - returns a template for the template multiplexer (no assumptions, can be custom?)
 *
 * @param res
 */
function renderTemplate(res) {
  return function (data) {
    if (data.site) {
      try {
        res.send(multiplex.render(getTemplate(data[baseTemplateProperty]), data));
      } catch (e) {
        log.error(e.message, e.stack);
        res.status(500).send('ERROR: Cannot render template!');
      }
    } else {
      //log.warn('Missing data.site');
      res.status(404).send('404 Not Found');
    }
  };
}

/**
 * Get state object that is used to render the templates
 * @param componentReference
 * @param res
 * @returns {{site: object, locals: object, getTemplate: getTemplate}}
 */
function getState(componentReference, res) {
  var site = siteService.sites()[res.locals.site],
    locals = res.locals;

  var state = {
    site: site,
    locals: locals,
    getTemplate: getTemplate
  };

  state[baseTemplateProperty] = schema.getComponentNameFromPath(componentReference);

  return state;
}

/**
 * Given a component reference of the form /components/<name> or /components/<name>/instances/<id>, render that component.
 *
 * Available optional options:
 *
 * {boolean} allowCustomBaseTemplate - If false, disallow custom base templates from db
 *
 * @param {string} componentReference
 * @param res
 * @param {{}} [options]
 * @returns {Promise}
 */
function renderComponent(componentReference, res, options) {
  //this is a possible entry point, so guarantee this existence
  options = options || {};

  //assertions
  if (!res.locals) {
    throw new Error('missing res.locals');
  } else if (!res.locals.site) {
    throw new Error('missing res.locals.site');
  }

  var state = getState(componentReference, res);

  return db.get(componentReference)
    .then(JSON.parse)
    .then(schema.resolveDataReferences)
    .then(addState(state, options))
    .then(addDynamicState)
    .then(renderTemplate(res));
}


/**
 * Given a page reference of the form /pages/<pagename>, lookup the alias and render that component
 * @param {string} pageReference
 * @param res
 * @returns {Promise}
 * @example renderPage('/pages/bG9jYWxob3N0LnZ1bHR1cmUuY29tL2Zhdmljb24uaWNv', res);
 */
function renderPage(pageReference, res) {
  log.info('rendering page ' + pageReference);

  //look up page alias' component instance
  return db.get(pageReference).then(function (result) {
    return renderComponent(result, res);
  });
}

module.exports = function (req, res) {
  var pageReference = '/pages/' + new Buffer(req.vhost.hostname + req.url).toString('base64');

  renderPage(pageReference, res)
    .catch(function (err) {
      log.warn(req.vhost.hostname + req.url + '\n' + chalk.dim(err.stack));
    });
};

module.exports.getTemplate = getTemplate; // for testing
module.exports.renderPage = renderPage;
module.exports.renderComponent = renderComponent;