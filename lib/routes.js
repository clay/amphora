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
  sitesFolder = siteService.sitesFolder,
  composer = require('./composer'),
  path = require('path'),
  responses = require('./responses'),
  files = require('./files');

/**
 * add site.slug to locals for each site
 * @param {{slug: {string}}} [options]
 * @returns {function}
 */
function addSiteLocals(options) {
  return function (req, res, next) {
    res.locals.url = req.protocol + '://' + req.get('host') + req.originalUrl;

    if (options && options.slug) {
      res.locals.site = options.slug;
    }

    next();
  };
}

/**
 * add edit mode for each site
 * @returns {function}
 */
function addEditMode() {
  return function (req, res, next) {
    // add isEdit to the locals. it'll be ignored by the db lookup
    res.locals.isEditMode = !!req.query.edit;
    next();
  };
}

/**
 * Add component routes to this router.
 * @param {express.Router} router
 */
function addControllerRoutes(router) {
  var routesPath = '/routes';

  // assume json for anything in request bodies
  router.use(require('body-parser').json({strict: true, type: 'application/json'}));
  router.use(require('body-parser').text({type: 'text/*'}));

  // load all controller routers
  _.each(files.getFiles(path.resolve(__dirname, routesPath)), function (filename) {
    var pathContainer,
      name = responses.removeExtension(filename),
      controller = require('.' + routesPath + '/' + name);

    pathContainer = express.Router(); // eslint-disable-line
    controller(pathContainer);

    router.use('/' + name, pathContainer);
  });
}

/**
 *
 * @param {express.Router} router
 * @param {object} options
 */
function addSite(router, options) {
  var siteRouter = express.Router(), // eslint-disable-line
    routePath;

  options = _.defaults(options || {}, {
    path: '/'
  });

  routePath = options.path;

  // add res.locals.site (slug) to every request
  router.use(routePath, addSiteLocals(options));

  // parse querystring for ?edit=true (this should probably be at the host level?)
  router.use(routePath, addEditMode());

  // components, pages and schema have priority over user-defined routes (this should probably be at the host level?)
  addControllerRoutes(router);

  // optional module to load routes and configuration defined from outside of byline
  if (options.siteResolver) {
    router.use(routePath, options.siteResolver(siteRouter, options));
  }
}

/**
 * @param {string} a
 * @param {string} b
 * @returns {number}
 */
function sortByDepthOfPath(a, b) {
  // sort by the depth of the path, so we can have domain.com/ and domain.com/foo/ as two separate sites
  return a.path.split('/').length - b.path.split('/').length;
}

/**
 * @param {string} hostname
 * @returns {{slug: {string}, name: {string}, host: {string}, path: {string}}}
 * @example
 *
 *  www.example.com becomes:
 *
 *  {
 *    slug: example
 *    name: Example
 *    host: www.example.com
 *    path: '/'
 *  }
 */
function getDefaultSiteSettings(hostname) {
  var name = _.takeRight(hostname.split('.'), 2)[0]; // penultimate or last

  return {
    slug: name.toLowerCase(),
    name: _.startCase(name),
    host: hostname,
    path: '/'
  };
}

/**
 * Default way to load site controllers.
 *
 * @param {express.Router} router
 * @param {object} data  Extra information to help load controllers
 * @returns {function}
 */
function resolveSiteController(router, data) {
  var controllerPath = path.join(sitesFolder, data.slug);

  return require(controllerPath)(router, composer);
}

/**
 * @param {express.Router} router
 * @param {string} hostname
 * @param {object} [options]
 * @param {array} [options.sites]
 * @param {object} [options.siteResolver] Site router
 *
 * @example addHost('www.example.com');
 */
function addHost(router, hostname, options) {
  var hostRouter, sites;

  options = options || {};
  hostRouter = express.Router(); // eslint-disable-line
  sites = options.sites || [getDefaultSiteSettings(hostname)];

  _.each(sites, function (site) {
    // pass whatever options were given for the host, plus any extra information for the site.
    addSite(hostRouter, _.defaults(site, options));
  });

  // once all sites are added, wrap them in a vhost
  router.use(vhost(hostname, hostRouter));
}

/**
 * @param {object} router  Often an express app.
 * @returns {*}
 * @example
 *   var app = express();
 *   require('./routes)(app);
 */
function loadFromConfig(router) {
  var siteHosts = siteService.hosts(),
    sitesMap = siteService.sites(),
    hostMap = config.get('hosts'); // includes local.yaml

  // iterate through the hosts
  _.each(siteHosts, function (hostname) {
    var sites = _.filter(sitesMap, {host: hostname}).sort(sortByDepthOfPath),
      localHostname = hostMap[hostname] || hostname;

    addHost(router, localHostname, {
      sites: sites,
      siteResolver: resolveSiteController
    });
  });
  return router;
}

module.exports = loadFromConfig;
module.exports.addSite = addSite;
module.exports.addHost = addHost;
module.exports.getDefaultSiteSettings = getDefaultSiteSettings;
module.exports.sortByDepthOfPath = sortByDepthOfPath;
