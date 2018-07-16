'use strict';

const bluebird = require('bluebird'),
  db = require('../services/db'),
  { getMeta, patchMeta } = require('../services/metadata');
var pluginDBAdapter;

function initPlugins(router) {
  return bluebird.all(module.exports.plugins.map(plugin => {
    return bluebird.try(() => {
      if (typeof plugin === 'function') {
        return plugin(router, pluginDBAdapter, publish);
      } else {
        // TODO: logger, plz
        console.log('warn', 'plugin is not a function');
      }
    });
  }));
}

function createDBAdapter() {
  return {
    getMeta,
    patchMeta,
    raw: db.raw
  };
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
