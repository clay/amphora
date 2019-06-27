'use strict';

const bluebird = require('bluebird'),
  db = require('../services/db'),
  sites = require('../services/sites'),
  { getMeta, patchMeta } = require('../services/metadata'),
  { publish } = require('../services/bus');
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
 * @param {Object} site
 * @returns {Promise}
 */
function initPlugins(router, site) {
  return bluebird.all(module.exports.plugins.map(plugin => {
    return bluebird.try(() => {
      if (typeof plugin === 'function') {
        return plugin(router, pluginDBAdapter, publish, sites, site);
      } else {
        log('warn', 'Plugin is not a function');
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
  // Need to wrap the DB methods in automatic publish to bus
  pluginDBAdapter = createDBAdapter();
  module.exports.plugins = plugins;
}

module.exports.plugins = [];
module.exports.registerPlugins = registerPlugins;
module.exports.initPlugins = initPlugins;

// For testing
module.exports.setLog = mock => log = mock;
