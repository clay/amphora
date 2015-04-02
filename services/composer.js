'use strict';
var config = require('config'),
  glob = require('glob'),
  log = require('./log'),
  siteService = require('./sites'),
  nunjucks = require('nunjucks-filters'),
  multiplex = require('multiplex-templates')({nunjucks: nunjucks()}),
  db = require('./db'),
  schema = require('./schema'),
  _ = require('lodash'),
  chalk = require('chalk');

/**
 * get full filename w/ extension
 * @param  {string} name e.g. "entrytext"
 * @return {string}          e.g. "components/entrytext/template.jade"
 */
function getTemplate(name) {
  var filePath = 'components/' + name + '/' + config.get('names.template'),
    possibleTemplates = glob.sync(filePath + '.*');

  if (!possibleTemplates.length) {
    throw new Error('No template files found for ' + filePath);
  }

  // return the first template found
  return possibleTemplates[0];
}

/**
 * Add state to result, which adds functionality and information about this request to the templates.
 * @param state
 * @returns {Function}
 */
function addState(state) {
  return function (result) {
    log.info(chalk.dim('serving ' + require('util').inspect(result, true, 5)));

    //the circle of life;  this is equivalent to what was here before.
    _.assign(state, result);
    state.state = state;

    return state;
  };
}

/**
 * Given a component reference of the form /components/<name> or /components/<name>/instances/<id>, render that component.
 * @param {string} componentReference
 * @param res
 * @returns {Promise}
 */
function renderComponent(componentReference, res) {

  //assertions
  if (!res.locals) {
    throw new Error('missing res.locals');
  } else if (!res.locals.site) {
    throw new Error('missing res.locals.site');
  }

  var data,
    baseTemplate = getTemplate(schema.getComponentNameFromPath(componentReference)),
    site = siteService.sites()[res.locals.site],
    locals = res.locals,
    state = {
      site: site,
      locals: locals,
      getTemplate: getTemplate
    };

  return db.get(componentReference)
    .then(JSON.parse)
    .then(schema.resolveDataReferences)
    .then(addState(state))
    .then(function (data) {
      if (site) {
        try {
          res.send(multiplex.render(baseTemplate, data));
        } catch (e) {
          log.error(e.message, e.stack);
          res.status(500).send('ERROR: Cannot render template!');
        }
      } else {
        res.status(404).send('404 Not Found');
      }
    });
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