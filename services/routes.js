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
  winston = require('winston');

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
  winston.warn('Not Implemented', 501, req.url, req.params);
  res.sendStatus(501);
}

/**
 * This route gets straight from the db.
 * @param req
 * @param res
 */
function getRouteTypically(req, res) {
  db.get(req.url)
    .then(JSON.parse)
    .then(function (result) {
      res.json(result);
    }).catch(function (err) {
      if (err.name === 'NotFoundError') {
        res.status(404).send('Not Found');
      } else {
        winston.error(err.stack);
        res.status(500).send(err.message);
      }
    });
}

/**
 * This route puts staight to the db.
 * @param req
 * @param res
 */
function putRouteTypically(req, res) {
  db.put(req.url, JSON.stringify(req.body)).then(function (result) {
    res.json(result);
  }).catch(function (err) {
    winston.error(err.stack);
    res.status(500).send(err.message);
  });
}

/**
 * Add component routes to this router.
 * @param router
 */
function addComponentRoutes(router) {
  router.use(bodyParser.json());

  router.get('/components', notImplemented);
  router.get('/components/:name', getRouteTypically);
  router.put('/components/:name', putRouteTypically);
  router.get('/components/:name/instances', notImplemented);
  router.get('/components/:name/instances/:id', getRouteTypically);
  router.put('/components/:name/instances/:id', putRouteTypically);
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