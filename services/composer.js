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
  ignoreDataProperty = 'ignore-data';

/**
 * get full filename w/ extension
 * @param  {string} name e.g. "entrytext"
 * @return {string}          e.g. "components/entrytext/template.jade"
 */
function getTemplate(name) {
  if (!name) {
    throw new Error('Missing template ' + name);
  }

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
 * @param options
 * @returns {Function}
 */
function applyOptions(options, res) {
  return function (result) {
    var site = siteService.sites()[res.locals.site],
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
    var state = {
      site: site,
      locals: locals,
      getTemplate: getTemplate
    };

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
    return require(path.join(files.getComponentPath(state.template), 'server.js'))(state.locals.url, state);
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
 * {function} getTemplate - returns a template for the template multiplexer (no assumptions, can be custom?)
 *
 * @param res
 */
function renderTemplate(res) {
  return function (data) {
    if (data.site) {
      try {
        res.send(multiplex.render(getTemplate(data.template), data));
      } catch (e) {
        log.error(e.message, e.stack);
        res.status(500).send('ERROR: Cannot render template!');
      }
    } else {
      res.status(404).send('404 Not Found');
    }
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
  if (!res.locals) {
    throw new Error('missing res.locals');
  } else if (!res.locals.site) {
    throw new Error('missing res.locals.site');
  } else if (!_.isObject(options.data)) {
    throw new Error('missing options.data');
  } else if (!_.isString(options.data.template)) {
    throw new Error('missing options.data.template');
  }

  return schema.resolveDataReferences(options.data)
    .then(applyOptions(options, res))
    .then(renderTemplate(res));
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
  if (!res.locals) {
    throw new Error('missing res.locals', componentReference);
  } else if (!res.locals.site) {
    throw new Error('missing res.locals.site', componentReference, res.locals);
  } else if (!componentName) {
    throw new Error('missing component name', componentReference);
  }

  return db.get(componentReference)
    .then(JSON.parse)
    .then(function (data) {
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
          }
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
  log.info('rendering page ' + pageReference);

  //look up page alias' component instance
  return db.get(pageReference)
    .then(JSON.parse)
    .then(function (result) {

      var layoutReference = result.layout,
        layoutComponentName = schema.getComponentNameFromPath(layoutReference),
        pageData = _.omit(result, 'layout');

      if (!layoutReference || !layoutComponentName) {
        throw new Error('Page is missing layout: ' + pageReference + ' ' + result + ' ' + JSON.stringify(result));
      } else {
        log.info('using ', layoutReference, layoutComponentName);
      }

      return db.get(layoutReference)
        .then(JSON.parse)
        .then(mapLayoutToPageData.bind(this, pageData))
        .then(function (result) {
          log.info('result ' + JSON.stringify(result));
          var options = { data: result };
          options.data.template = layoutComponentName;
          return renderByConfiguration(options, res);
        });
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