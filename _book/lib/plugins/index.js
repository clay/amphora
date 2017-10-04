'use strict';

const _ = require('lodash');

/**
 * Iterate through plugins and try to execute
 * a function exported by any plugin that has
 * been registered.
 *
 * @param  {String} key
 * @param  {Any} args
 */
function executeHook(key, args) {
  _.map(module.exports.plugins, (plugin) => {
    if (_.isFunction(plugin[key])) {
      plugin[key](args);
    }
  });
}

/**
 * Register plugins passed in at instantiation time.
 * Also fires the `init` hook.
 *
 * @param  {Array} plugins [description]]
 */
function registerPlugins(plugins) {
  module.exports.plugins = plugins;

  executeHook('init');
}

module.exports.plugins = [];
module.exports.registerPlugins = registerPlugins;
module.exports.executeHook = executeHook;
