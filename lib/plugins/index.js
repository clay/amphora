'use strict';

const bluebird = require('bluebird'),
  db = require('../services/db');


function initPlugins(router) {
  return bluebird.all(module.exports.plugins.map(plugin => {
    return bluebird.try(() => {
      if (typeof plugin === 'function') {
        return plugin(router, db);
      } else {
        console.log('warn', 'plugin is not a function');
      }
    });
  }));
}

/**
 * Register plugins passed in at instantiation time.
 * Also fires the `init` hook.
 *
 * @param  {Array} plugins [description]]
 */
function registerPlugins(plugins) {
  module.exports.plugins = plugins;
}

module.exports.plugins = [];
module.exports.registerPlugins = registerPlugins;
module.exports.initPlugins = initPlugins;
