/**
 * Handling all routing.
 *
 * This is the only file that should be saying things like res.send, or res.json.
 *
 * @module
 */

'use strict';
var _ = require('lodash'),
  express = require('express'),
  vhost = require('vhost'),
  config = require('config'),
  siteService = require('./sites'),
  sitesMap = siteService.sites(),
  siteHosts = siteService.hosts(),
  sitesFolder = siteService.sitesFolder,
  db = require('./db'),
  bodyParser = require('body-parser'),
  log = require('./log'),
  composer = require('./composer'),
  path = require('path'),
  references = require('./references'),
  bluebird = require('bluebird'),
// allowable query string variables
  queryStringOptions = ['ignore-data'];

/**
 * Remove extension from route / path.
 * @param {string} path
 * @returns {string}
 */
function removeExtension(path) {
  return path.split('.').shift();
}

/**
 * add site.slug to locals for each site
 * @param {string} slug
 */
function addSiteLocals(slug) {
  return function (req, res, next) {
    res.locals.url = req.protocol + '://' + req.get('host') + req.originalUrl;
    res.locals.site = slug;
    next();
  };
}

/**
 * syntactical sugar to quickly add routes that point directly to a layout
 * @param {string} route  e.g. '/users/:id'
 * @param {string} layout e.g. 'user-page'
 * note: all params will automatically be added to res.locals
 */
function setLayout(route, layout) {
  this.get(route, function (req, res, next) { // jshint ignore:line
    res.locals = req.params; // add all params
    res.locals.layout = layout; // add layout
    next();
  });
}

/**
 * This route is not implemented.
 * @param req
 * @param res
 */
function notImplemented(req, res) {
  log.warn('Not Implemented', 501, req.url, req.params);
  res.sendStatus(501);
}

/**
 * All "Not Found" errors are routed like this.
 * @param {Error} [err]
 * @param res
 */
function notFound(err, res) {
  if (err instanceof Error) {
    log.info('Not found: ' + err.stack);
  } else if (err) {
    res = err;
  }

  //hide error from user of api.
  res.status(404).format({
    json: function () {
      //send the message as well
      res.send({
        message: 'Not Found',
        code: 404
      });
    },
    html: function () {
      //send some html (should probably be some default, or render of a 404 page).
      res.send('404 Not Found');
    },
    'default': function () {
      //send whatever is default for this type of data with this status code.
      res.sendStatus(404);
    }
  });
}

/**
 * All server errors should look like this.
 *
 * In general, 500s represent a _developer mistake_.  We should try to replace them with more descriptive errors.
 * @param {Error} err
 * @param res
 */
function serverError(err, res) {
  //error is required to be logged
  log.error(err.stack);

  res.status(500).format({
    json: function () {
      //send the message as well
      res.send({
        message: err.message,
        code: 500
      });
    },
    html: function () {
      //send some html (should probably be some default, or a render of a 500 page).
      res.send('500 Server Error');
    },
    'default': function () {
      //send whatever is default for this type of data with this status code.
      res.sendStatus(500);
    }
  });
}

function handleError(res) {
  return function (err) {
    if ((err.name === 'NotFoundError') ||
      (err.message.indexOf('ENOENT') !== -1) ||
      (err.message.indexOf('not found') !== -1)) {
      notFound(err, res);
    } else {
      serverError(err, res);
    }
  };
}

/**
 * Reusable code to return JSON data, both for good results AND errors.
 *
 * Captures and hides appropriate errors.
 *
 * These return JSON always, because these endpoints are JSON-only.
 * @param {function} fn
 * @param res
 */
function expectJSON(fn, res) {
  bluebird.try(fn).then(function (result) {
    res.json(result);
  }).catch(handleError(res));
}

/**
 * Reusable code to return JSON data, both for good results AND errors.
 *
 * Captures and hides appropriate errors.
 *
 * These return HTML always, because these endpoints are HTML-only.
 * @param {function} fn
 * @param res
 */
function expectHTML(fn, res) {
  bluebird.try(fn).then(function (result) {
    res.send(result);
  }).catch(handleError(res));
}

/**
 * @param req
 * @param res
 */
function getRouteFromComponent(req, res) {
  expectJSON(function () {
    return references.getComponentData(removeExtension(req.url));
  }, res);
}

/**
 * @param req
 * @param res
 */
function putRouteFromComponent(req, res) {
  expectJSON(function () {
    return references.putComponentData(removeExtension(req.url), req.body);
  }, res);
}

/**
 * This route gets straight from the db.
 * @param req
 * @param res
 */
function getRouteFromDB(req, res) {
  expectJSON(function () {
    return db.get(removeExtension(req.url)).then(JSON.parse);
  }, res);
}

/**
 * This route puts straight to the db.
 *
 * Assumptions:
 * - that there is no extension if they're putting data.
 * @param req
 * @param res
 */
function putRouteFromDB(req, res) {
  expectJSON(function () {
    return db.put(removeExtension(req.url), JSON.stringify(req.body));
  }, res);
}

/**
 * Return a schema for a component
 *
 * @param req
 * @param res
 */
function getSchema(req, res) {
  expectJSON(function () {
    return references.getSchema(removeExtension(req.url));
  }, res);
}

/**
 * returns HTML
 *
 * @param req
 * @param res
 */
function renderComponent(req, res) {
  expectHTML(function () {
    return composer.renderComponent(removeExtension(req.url), res, _.pick(req.query, queryStringOptions));
  }, res);
}

/**
 * Change the acceptance type based on the extension they gave us
 *
 * @param req
 * @param res
 */
function routeByExtension(req, res) {
  log.info('routeByExtension', req.params);

  switch (req.params.ext.toLowerCase()) {
    case 'html':
      req.headers.accept = 'text/html';
      renderComponent(req, res);
      break;

    case 'yaml':
      req.headers.accept = 'text/yaml';
      notImplemented(req, res);
      break;

    case 'json': // jshint ignore:line
    default:
      req.headers.accept = 'application/json';
      getRouteFromComponent(req, res);
      break;
  }
}

/**
 * Add component routes to this router.
 * @param router
 */
function addComponentRoutes(router) {
  router.use(bodyParser.json());

  router.get('/components', notImplemented);
  router.get('/components/:name.:ext', routeByExtension);
  router.get('/components/:name', getRouteFromComponent);
  router.put('/components/:name', putRouteFromComponent);

  router.get('/components/:name/instances', notImplemented);
  router.get('/components/:name/instances/:id.:ext', routeByExtension);
  router.get('/components/:name/instances/:id', getRouteFromComponent);
  router.put('/components/:name/instances/:id', putRouteFromComponent);

  router.get('/components/:name/schema', getSchema);

  router.get('/pages', notImplemented);
  router.get('/pages/:name', getRouteFromDB);
  router.put('/pages/:name', putRouteFromDB);

}

module.exports = function (app) {
  // iterate through the hosts
  _.map(siteHosts, function (host) {
    var sitesOnThisHost = _.filter(sitesMap, {host: host}).sort(function (a, b) {
        // sort by the depth of the path, so we can have domain.com/ and domain.com/foo/ as two separate sites
        return a.path.split('/').length - b.path.split('/').length;
      }),
      hostMiddleware = express.Router(),
      envHost = config.get('hosts')[host]; // get the "host" for the current env, e.g. localhost

    // iterate through the sites on this host, add routers
    _.map(sitesOnThisHost, function (site) {
      var siteController = path.join(sitesFolder, site.slug),
        siteRouter = express.Router();

      // add support for site.setLayout sugar
      siteRouter.setLayout = setLayout;

      // add res.locals.site (slug) to every request
      hostMiddleware.use(site.path, addSiteLocals(site.slug));
      //components, pages and schema have priority
      addComponentRoutes(hostMiddleware);
      // add the routes for that site's path
      hostMiddleware.use(site.path, require(siteController)(siteRouter, composer));
    });

    // once all sites are added, wrap them in a vhost
    app.use(vhost(envHost, hostMiddleware));
  });
  return app;
};