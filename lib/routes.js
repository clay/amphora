/**
 * Handling all routing.
 *
 * This and responses.js are the only files that should be saying things like res.send, or res.json.
 *
 * @module
 */

'use strict';
const _ = require('lodash'),
  express = require('express'),
  path = require('path'),
  siteService = require('./services/sites'),
  htmlComposer = require('./html-composer'),
  responses = require('./responses'),
  files = require('./files'),
  references = require('./services/references'),
  sitemaps = require('./sitemaps'),
  auth = require('./auth'),
  cors = {
    origins: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE'].join(','),
    headers: ['Accept', 'Accept-Encoding', 'Authorization', 'Content-Type', 'Host', 'Referer', 'Origin', 'User-Agent',
      'X-Forwarded-For', 'X-Forwarded-Host', 'X-Forwarded-Proto'].join(',')
  };

/**
 * Add site.slug to locals for each site
 *
 * @param {object} site
 * @returns {Function}
 */
function addSiteLocals(site) {
  return function (req, res, next) {

    res.locals.url = references.uriToUrl(req.hostname + req.originalUrl, site.proto, site.port);
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
 * adds query params to locals
 * @param {req}   req
 * @param {res}   res
 * @param {next} next
 */
function addQueryParams(req, res, next) {
  _.assign(res.locals, req.params, req.query);

  next();
}

/**
 * add available site routes to locals
 * @param {express.Router} router
 * @returns {function}
 */
function addAvailableRoutes(router) {
  return function (req, res, next) {
    var routes = _(router.stack)
      .filter((r) => r.route && r.route.path) // grab only the defined routes (not api stuff)
      .map((r) => r.route.path) // pull out their paths
      .reject((r) => _.includes(['/sitemap.txt', '/sitemap.xml'], r)) // filter out sitemaps
      .value();

    res.locals.routes = routes; // and add them to the locals
    next();
  };
}

/**
 * add available components to locals
 * @param {req} req
 * @param {res} res
 * @param {function} next
 */
function addAvailableComponents(req, res, next) {
  res.locals.components = files.getComponents();
  next();
}

/**
 * add current user to locals
 * @param {req} req
 * @param {res} res
 * @param {function} next
 */
function addUser(req, res, next) {
  res.locals.user = req.user;
  next();
}

/**
 * @param {object} req
 * @param {object} res
 * @param {function} next
 */
function addUri(req, res, next) {
  let version;

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
 * Add route controllers to this router.
 * Note: This adds all controllers defined in lib/routes/
 * @param {express.Router} router
 */
function addControllerRoutes(router) {
  const routesPath = 'routes';

  // load all controller routers
  _.each(files.getFiles([__dirname, routesPath].join(path.sep)), function (filename) {
    let pathRouter,
      name = responses.removeExtension(filename),
      controller = files.tryRequire(['.', routesPath, name].join(path.sep));

    // we're okay with an error occurring here because it means we're missing something important in a route
    pathRouter = express.Router();

    // assume json or text for anything in request bodies
    pathRouter.use(require('body-parser').json({strict: true, type: 'application/json', limit: '50mb'}));
    pathRouter.use(require('body-parser').text({type: 'text/*'}));

    controller(pathRouter);

    router.use('/' + name, pathRouter);
  });
}

/**
 * Add CORS
 *
 * Overwritten by site settings
 * @param {object} site
 * @returns {Function}
 */
function addCORS(site) {
  const local = site.cors || {};

  return function (req, res, next) {
    if (req.headers.origin) {
      res.header('Access-Control-Allow-Origin', local.origins || cors.origins);
    }
    if (req.method === 'OPTIONS') {
      res.header('Access-Control-Allow-Methods', local.methods || cors.methods);
      res.header('Access-Control-Allow-Headers', local.headers || cors.headers);
      res.status(200).send();
    } else {
      next();
    }
  };
}

/**
 * Default way to load site controllers.
 *
 * @param {express.Router} router
 * @param {object} site
 * @returns {express.Router}
 */
function addSiteController(router, site) {
  if (site.dir) {
    const controller = files.tryRequire(site.dir);

    if (controller) {
      if (_.isFunction(controller)) {
        controller(router, htmlComposer, site);
      }

      // things to remember from controller
      _.assign(site, _.pick(controller, 'resolveMedia'));
      _.assign(site, _.pick(controller, 'resolvePublishing'));
    }
  }

  return router;
}

/**
 * @param {express.Router} router
 * @param {array} providers
 * @param {object} site
 */
function addSite(router, providers, site) {
  site = _.defaults(site, { path: '/' });
  const path = site.path,
    siteRouter = express.Router();

  // authentication added first to protect all routes
  auth(siteRouter, providers, site);

  siteRouter.use(addUser);
  siteRouter.use(addUri);
  siteRouter.use(addSiteLocals(site));
  siteRouter.use(addAssetDirectory(site));
  siteRouter.use(addCORS(site));

  // add query params to res.locals
  siteRouter.use(addQueryParams);

  // add available routes to locals
  siteRouter.use(addAvailableRoutes(siteRouter));

  // add available components to locals
  siteRouter.use(addAvailableComponents);

  // optional module to load routes and configuration defined from outside of amphora
  router.use(path, addSiteController(siteRouter, site));

  sitemaps.routes(siteRouter);

  // amphora api routes added afterwards, so they can change things about the site routes for additional functionality
  addControllerRoutes(siteRouter);

  router.use(path, siteRouter);
}

/**
 * @param {object} a
 * @param {object} b
 * @returns {number}
 */
function sortByDepthOfPath(a, b) {
  // sort by the depth of the path, so we can have domain.com/ and domain.com/foo/ as two separate sites
  return a.path.split('/').length - b.path.split('/').length;
}

/**
 * @param {string} hostname
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
  const name = _.takeRight(hostname.split('.'), 2)[0]; // penultimate or last

  return {
    slug: name.toLowerCase(),
    name: _.startCase(name),
    host: hostname,
    path: '/',
    prefix: hostname,
    assetDir: 'public'
  };
}

/**
 * Virtual hosts
 *
 * Express depends on vhost, so we don't have to.
 *
 * @param {string} hostname
 * @param {express.Router} router
 * @returns {Function}
 * @see https://www.npmjs.com/package/vhost
 */
function vhost(hostname, router) {
  return function (req, res, next) {
    if (req.hostname === hostname) {
      router(req, res, next);
    } else {
      next();
    }
  };
}

/**
 * @param {express.Router} router
 * @param {string} hostname
 * @param {Array} [sites]  Within a host, there can exist many sites at different paths
 * @param {array} [providers]
 *
 * @example addHost('www.example.com');
 */
function addHost(router, hostname, sites, providers) {
  sites = sites || [getDefaultSiteSettings(hostname)];
  const hostRouter = express.Router();

  _.each(sites, addSite.bind(null, hostRouter, providers));

  // once all sites are added, wrap them in a vhost
  router.use(vhost(hostname, hostRouter));
}

/**
 * @param {express.Router} router  Often an express app.
 * @param {array} [providers]
 * @returns {*}
 * @example
 *   var app = express();
 *   require('./routes)(app);
 */
function loadFromConfig(router, providers) {
  const sitesMap = siteService.sites(),
    siteHosts = _.uniq(_.map(sitesMap, 'host'));

  // iterate through the hosts
  _.each(siteHosts, function (hostname) {
    const sites = _.filter(sitesMap, {host: hostname}).sort(sortByDepthOfPath);

    addHost(router, hostname, sites, providers);
  });
  return router;
}

module.exports = loadFromConfig;
module.exports.addSite = addSite;
module.exports.addHost = addHost;
module.exports.getDefaultSiteSettings = getDefaultSiteSettings;
module.exports.sortByDepthOfPath = sortByDepthOfPath;
module.exports.addCORS = addCORS;
module.exports.addAvailableRoutes = addAvailableRoutes;
module.exports.addAvailableComponents = addAvailableComponents;
module.exports.addSiteController = addSiteController;
