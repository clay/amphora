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
  schema = require('./schema'),
  composer = require('./composer'),
  path = require('path');

function removeExtension(path) {
  return path.split('.').shift();
}

/**
 * add site.slug to locals for each site
 * @param {string} slug
 */
function addSiteLocals(slug) {
  return function (req, res, next) {
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
 * This route gets straight from the db.
 * @param req
 * @param res
 */
function getRouteTypically(req, res) {
  db.get(removeExtension(req.url))
    .then(JSON.parse)
    .then(function (result) {
      log.info('yes?', result);
      res.json(result);
    }).catch(function (err) {
      if (err.name === 'NotFoundError') {
        log.info('no?', err);
        res.status(404).send('Not Found');
      } else {
        log.error(err.stack);
        res.status(500).send(err.message);
      }
    });
}

/**
 * This route puts straight to the db.
 *
 * Assumptions:
 * - that there is no extension if they're putting data.
 * @param req
 * @param res
 */
function putRouteTypically(req, res) {
  db.put(req.url, JSON.stringify(req.body)).then(function () {
    res.json(req.body);
  }).catch(function (err) {
    log.error(err.stack);
    res.status(500).send(err.message);
  });
}

/**
 * Return a schema for a component
 * @param req
 * @param res
 */
function getSchema(req, res) {
  var componentSchema,
    componentName = schema.getComponentNameFromPath(removeExtension(req.url));

  if (componentName) {
    try {
      componentSchema = schema.getSchema(path.resolve('components', componentName));
      res.json(componentSchema);
    } catch(err) {
      if (err.message.indexOf('ENOENT') !== -1) {
        res.sendStatus(404);
      } else {
        res.status(500).send(err.message);
      }
    }
  } else {
    res.sendStatus(404);
  }
}

function renderComponent(req, res) {
  composer.renderComponent(removeExtension(req.url), res);
}

function routeByExtension(req, res) {
  log.info('routeByExtension', req.params);

  switch(req.params.ext.toLowerCase()) {
    case 'html':
      renderComponent(req, res);
      break;
    case 'json':
    default:
      getRouteTypically(req, res);
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
  router.get('/components/:name', getRouteTypically);
  router.put('/components/:name', putRouteTypically);

  router.get('/components/:name/instances', notImplemented);
  router.get('/components/:name/instances/:id.:ext', routeByExtension);
  router.get('/components/:name/instances/:id', getRouteTypically);
  router.put('/components/:name/instances/:id', putRouteTypically);

  router.get('/components/:name/schema', getSchema);

  router.get('/pages', notImplemented);
  router.get('/pages/:name', getRouteTypically);
  router.put('/pages/:name', putRouteTypically);

}

module.exports = function (app) {
  // iterate through the hosts
  _.map(siteHosts, function (host) {
    var sitesOnThisHost = _.filter(sitesMap, { host: host }).sort(function (a, b) {
        // sort by the depth of the path, so we can have domain.com/ and domain.com/foo/ as two separate sites
        return a.path.split('/').length - b.path.split('/').length;
      }),
      hostMiddleware = express.Router(),
      envHost = config.get('hosts')[host]; // get the "host" for the current env, e.g. localhost

    // iterate through the sites on this host, add routers
    _.map(sitesOnThisHost, function (site) {
      var siteController = sitesFolder + site.slug,
        siteRouter = express.Router();

      // add support for site.setLayout sugar
      siteRouter.setLayout = setLayout;

      // add the routes for that site's path
      hostMiddleware.use(site.path, require(siteController)(siteRouter));
      // add res.locals.site (slug) to every request
      hostMiddleware.use(site.path, addSiteLocals(site.slug));

      addComponentRoutes(hostMiddleware);
    });

    // once all sites are added, wrap them in a vhost
    app.use(vhost(envHost, hostMiddleware));
  });
};