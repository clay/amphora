/**
 * Handling all routing.
 *
 * This and responses.js are the only files that should be saying things like res.send, or res.json.
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
  composer = require('./composer'),
  path = require('path'),
  responses = require('./responses'),
  files = require('./files'),
  log = require('./log');

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
 * add edit mode for each site
 */
function addEditMode() {
  return function (req, res, next) {
    // add isEdit to the locals. it'll be ignored by the db lookup
    res.locals.isEditMode = !!(req.query.edit);
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
 * Add component routes to this router.
 * @param router
 */
function addControllerRoutes(router) {
  //load all controller routers
  _.each(files.getFiles(__dirname + '/controllers'), function (filename) {
    var pathContainer,
      name = responses.removeExtension(filename),
      controller = require('./controllers/' + name);

    pathContainer = express.Router();
    controller(pathContainer);
    router.use('/' + name, pathContainer);
  });
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
      // parse querystring for ?edit=true
      hostMiddleware.use(site.path, addEditMode());
      //assume json for anything in request bodies
      hostMiddleware.use(require('body-parser').json());
      //components, pages and schema have priority
      addControllerRoutes(hostMiddleware);
      // add the routes for that site's path
      hostMiddleware.use(site.path, require(siteController)(siteRouter, composer));
    });

    // once all sites are added, wrap them in a vhost
    app.use(vhost(envHost, hostMiddleware));
  });
  return app;
};