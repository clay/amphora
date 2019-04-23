'use strict';

const _ = require('lodash'),
  express = require('express'),
  path = require('path'),
  siteService = require('./services/sites'),
  attachRoutes = require('./services/attachRoutes'),
  responses = require('./responses'),
  files = require('./files'),
  plugins = require('./services/plugins'),
  locals = require('./locals'),
  bus = require('./services/bus'),
  db = require('./services/db'),
  cors = {
    origins: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'].join(','),
    headers: ['Accept', 'Accept-Encoding', 'Authorization', 'Content-Type', 'Host', 'Referer', 'Origin', 'User-Agent',
      'X-Forwarded-For', 'X-Forwarded-Host', 'X-Forwarded-Proto'].join(',')
  },
  routesPath = 'routes',
  reservedRoutes = _.map(files.getFiles([__dirname, routesPath].join(path.sep)), responses.removeExtension);
let log = require('./services/logger').setup({ file: __filename }),
  amphoraAuth = require('amphora-auth');

attachRoutes.setReservedRoutes(reservedRoutes);

function addAssetDirectory(site) {
  if (!files.fileExists(site.assetDir)) {
    throw new Error('Asset directory does not exist: ' + site.assetDir);
  }

  return express.static(site.assetDir);
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
  // load all controller routers
  _.each(reservedRoutes, routeName => {
    let pathRouter,
      filename = routeName + '.js',
      controller = files.tryRequire([__dirname, routesPath, filename].join(path.sep));

    // we're okay with an error occurring here because it means we're missing something important in a route
    pathRouter = express.Router();

    // assume json or text for anything in request bodies
    pathRouter.use(require('body-parser').json({ strict: true, type: 'application/json', limit: '50mb' }));
    pathRouter.use(require('body-parser').text({ type: 'text/*' }));

    controller(pathRouter);

    router.use(`/${routeName}`, pathRouter);
  });
}

/**
 * Add routes from the authentication module that
 * can be passed in. If no module is passed in at
 * instantiation time then use the default auth module.
 *
 * @param {express.Router} router
 */
function addAuthenticationRoutes(router) {
  const authRouter = express.Router();

  authRouter.use(require('body-parser').json({ strict: true, type: 'application/json', limit: '50mb' }));
  authRouter.use(require('body-parser').text({ type: 'text/*' }));
  amphoraAuth.addRoutes(authRouter);
  router.use('/_users', authRouter);
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
 * @param {Object} site
 * @param {Array} providers
 * @returns {express.Router}
 */
function addSiteController(router, site, providers) {
  if (site.dir) {
    const controller = files.tryRequire(site.dir);

    if (controller) {
      if (Array.isArray(controller.middleware)) {
        router.use(controller.middleware);
      }

      if (Array.isArray(controller.routes)) {
        attachRoutes(router, controller.routes, site);
      } else {
        log('warn', `There is no router for site: ${site.slug}`);
      }

      // Providers are the same across all sites, but this is a convenient
      // place to store it so that it's available everywhere
      _.set(site, 'providers', providers);
      // things to remember from controller
      _.assign(site, _.pick(controller, 'resolvePublishing'));
      _.assign(site, _.pick(controller, 'resolvePublishUrl'));
      _.assign(site, _.pick(controller, 'modifyPublishedData'));
    }
  }

  return router;
}

/**
 * @param {express.Router} router
 * @param {Object} options
 * @param {Object} site
 * @returns {Promise}
 */
function addSite(router, { providers, sessionStore }, site) {
  site = _.defaults(site, { path: '/' }); // If path isn't explicitly set, set it.
  const path = site.path,
    siteRouter = express.Router();

  // authentication added first to protect all routes
  if (!_.isEmpty(providers)) {
    // Initialize auth module
    amphoraAuth({
      router: siteRouter,
      providers,
      store: sessionStore,
      site,
      storage: db,
      bus
    });
  }

  siteRouter.use(addUri);
  siteRouter.use(locals.addSiteData(site));
  siteRouter.use(addAssetDirectory(site));
  siteRouter.use(addCORS(site));

  // add query params to res.locals
  siteRouter.use(locals.addQueryParams);

  // add available routes to locals
  siteRouter.use(locals.addAvailableRoutes(siteRouter));

  // add available components to locals
  siteRouter.use(locals.addAvailableComponents);

  // Plugins can add routes to a site, fire that hook now to register those routes
  return plugins.initPlugins(siteRouter, site)
    .then(() => {
      const siteControllerConfig = site.dir ? files.tryRequire(site.dir) : {},
        midleware = _.get(siteControllerConfig, 'middleware', null);

      if (Array.isArray(midleware)) {
        siteRouter.use(midleware);
      }

      // amphora api routes added first so they're handled before site-specific routes which are generally registering less specific paths
      addControllerRoutes(siteRouter);
      addAuthenticationRoutes(siteRouter);

      if (!!siteControllerConfig) {
        // optional module to load routes and configuration defined from outside of amphora
        router.use(path, addSiteController(siteRouter, site, providers));
      }

      router.use(path, siteRouter);
    });
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
 * @param {object} options
 * @param {express.Router} options.router
 * @param {string} options.hostname
 * @param {Array} [options.sites]  Within a host, there can exist many sites at different paths
 * @param {array} [options.providers]
 * @param {object} [options.sessionStore]
 *
 * @example addHost('www.example.com');
 */
function addHost(options) {
  var sites = options.sites || [getDefaultSiteSettings(options.hostname)]; // Explicit variable for mutation later down the line
  const hostRouter = express.Router();

  _.each(sites, addSite.bind(null, hostRouter, options));

  // once all sites are added, wrap them in a vhost
  options.router.use(vhost(options.hostname, hostRouter));
}

/**
 * Loads sites config and attach the basic routes for each one.
 * @param {express.Router} router - Often an express app.
 * @param {Array} [providers]
 * @param {Object} [sessionStore]
 * @returns {*}
 * @example
 *   var app = express();
 *   require('./routes)(app);
 */
function loadFromConfig(router, providers, sessionStore) {
  const sitesMap = siteService.sites(),
    siteHosts = _.uniq(_.map(sitesMap, 'host'));

  // iterate through the hosts
  _.each(siteHosts, hostname => {
    const sites = _.filter(sitesMap, {host: hostname}).sort(sortByDepthOfPath);

    addHost({
      router,
      hostname,
      sites,
      providers,
      sessionStore
    });
  });

  return router;
}

module.exports = loadFromConfig;
module.exports.addSite = addSite;
module.exports.addHost = addHost;
module.exports.getDefaultSiteSettings = getDefaultSiteSettings;
module.exports.sortByDepthOfPath = sortByDepthOfPath;
module.exports.addCORS = addCORS;
module.exports.addSiteController = addSiteController;
// For testing
module.exports.setLog = mock => log = mock;
module.exports.setamphoraAuth = mock => amphoraAuth = mock;
module.exports.addAuthenticationRoutes = addAuthenticationRoutes;
