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
  siteService = require('./sites'),
  composer = require('./composer'),
  responses = require('./responses'),
  files = require('./files');

/**
 * Get site from options, verify its real, throw if not.
 *
 * @param {object} options
 * @throws Error if not a real site
 * @returns {object}
 */
function getSite(options) {
  var site = siteService.sites()[options.slug];

  if (!site) {
    throw new Error('Client: Invalid site ' + options.slug);
  }

  return site;
}

/**
 * Add site.slug to locals for each site
 *
 * @param {object} site
 */
function addSiteLocals(site) {
  return function (req, res, next) {
    res.locals.url = req.protocol + '://' + req.get('host') + req.originalUrl;
    res.locals.site = site;

    next();
  };
}

function addAssetDirectory(site) {
  if (!files.fileExists(site.assetDir)) {
    throw new Error('Asset directory does not exist: ' + site.assetDir);
  }

  return express.static(site.assetDir);
}

/**
 * @param req
 * @param res
 * @param {function} next
 */
function addUri(req, res, next) {
  var version;

  // Note: We're not putting this in locals, because we don't want to expose this to templates or allow it to be overwritten
  // by the query string.
  req.uri = responses.getUri(req);

  // Only set variable if version is truthy (not undefined, not false, not empty string, etc.)
  // Again note: don't expose this value in locals because this is internal.  A version exposed to templates can be done
  // later, but we're relying on this value before then.
  version = req.uri.split('@')[1];
  if (version) {
    req.version = version;
  }

  next();
}

/**
 * Add component routes to this router.
 * @param router
 */
function addControllerRoutes(router) {
  var routesPath = '/routes';

  // assume json for anything in request bodies
  router.use(require('body-parser').json({strict: true, type: 'application/json'}));
  router.use(require('body-parser').text({type: 'text/*'}));

  // load all controller routers
  _.each(files.getFiles(__dirname + routesPath), function (filename) {
    var pathContainer,
      name = responses.removeExtension(filename),
      controller = require('.' + routesPath + '/' + name);

    pathContainer = express.Router();
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
  options = _.defaults(options || {}, {
    path: '/'
  });
  var path = options.path,
    site = getSite(options),
    siteRouter = express.Router();

  // add res.locals.site (slug) to every request
  siteRouter.use(addUri);
  siteRouter.use(addSiteLocals(site));
  siteRouter.use(addAssetDirectory(site));

  // components, pages and schema have priority over user-defined routes
  addControllerRoutes(siteRouter);

  // optional module to load routes and configuration defined from outside of amphora
  if (options.siteResolver) {
    router.use(path, options.siteResolver(siteRouter, options));
  }

  router.use(path, siteRouter);
}

/**
 * @param a
 * @param b
 * @returns {number}
 */
function sortByDepthOfPath(a, b) {
  // sort by the depth of the path, so we can have domain.com/ and domain.com/foo/ as two separate sites
  return a.path.split('/').length - b.path.split('/').length;
}

/**
 * @param hostname
 * @returns {{slug: string, name: string, host: string, path: string}}
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
  return require(data.dir)(router, composer);
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
  options = options || {};
  var hostRouter = express.Router(),
    sites = options.sites || [getDefaultSiteSettings(hostname)];

  _.each(sites, function (site) {
    // pass whatever options were given for the host, plus any extra information for the site.
    addSite(hostRouter, _.defaults(site, _.omit(options, 'sites'))); //prevent circular reference
  });

  // once all sites are added, wrap them in a vhost
  router.use(vhost(hostname, hostRouter));
}

/**
 * @param router  Often an express app.
 * @returns {*}
 * @example
 *   var app = express();
 *   require('./routes)(app);
 */
function loadFromConfig(router) {
  var siteHosts = siteService.hosts(),
    sitesMap = siteService.sites();

  // iterate through the hosts
  _.each(siteHosts, function (hostname) {
    var sites = _.filter(sitesMap, {host: hostname}).sort(sortByDepthOfPath);

    addHost(router, hostname, {
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
