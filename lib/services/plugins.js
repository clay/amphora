'use strict';

const bluebird = require('bluebird'),
  db = require('../services/db'),
  sites = require('../services/sites'),
  { getMeta, patchMeta } = require('../services/metadata'),
  { publish } = require('../services/bus'),
  { removeQueryString } = require('../responses');

var log = require('./logger').setup({
    file: __filename
  }),
  pluginDBAdapter;


/**
 * Call each plugin and pass along the router,
 * a subset of the db service the publish method
 * of the bus service.
 *
 * @param {Object} router
 * @returns {Promise}
 */
function initPlugins(router) {
  return bluebird.all(module.exports.plugins.map(plugin => {
    return bluebird.try(() => {
      if (typeof plugin === 'function') {
        return plugin(router, pluginDBAdapter, publish, sites);
      } else if (typeof plugin.init === 'function') {
        return plugin.init(router, pluginDBAdapter, publish, sites);
      } else {
        log('warn', 'Plugin should be a function or have an init function');
        return bluebird.resolve();
      }
    });
  }));
}

/**
 * Builds the db object to pass to
 * the plugin. Needs to use the metadata
 * functions and not pass along `putMeta`
 *
 * @returns {Object}
 */
function createDBAdapter() {
  var returnObj = {
    getMeta,
    patchMeta
  };

  for (const key in db) {
    /* istanbul ignore else */
    if (db.hasOwnProperty(key) && key.indexOf('Meta') === -1) {
      returnObj[key] = db[key];
    }
  }

  return returnObj;
}

/**
 * Register plugins passed in at instantiation time.
 * Also fires the `init` hook.
 *
 * @param  {Array} plugins [description]]
 */
function registerPlugins(plugins) {
  module.exports.whitelist = getFullWhitelist(plugins);

  // Need to wrap the DB methods in automatic publish to bus
  pluginDBAdapter = createDBAdapter();
  module.exports.plugins = plugins;
}

function getFullWhitelist(plugins) {
  return plugins.reduce((output, plugin) => {
    return typeof plugin !== 'function' && plugin.whitelist && plugin.whitelist.length
      ? output.concat(plugin.whitelist)
      : output;
  }, []);
}

function skipAuth(req, res, next) {
  // Memoize this
  req.skipAuth = module.exports.whitelist.includes(removeQueryString(req.url));
  next();
}

module.exports.plugins = [];
module.exports.registerPlugins = registerPlugins;
module.exports.initPlugins = initPlugins;
module.exports.skipAuth = skipAuth;

// For testing
module.exports.setLog = mock => log = mock;
