'use strict';

const _ = require('lodash');

/**
 * [executeHook description]
 * @param  {String} key [description]
 * @return [type]       [description]
 */
function executeHook(key, args) {
  _.map(module.exports.plugins, (plugin) => {
    if (_.isFunction(plugin[key])) {
        plugin[key](...args);
    }
  });
}

/**
 * [registerPlugins description]
 * @param  {Array} plugins [description]]
 */
function registerPlugins(plugins) {
  module.exports.plugins = plugins;

  executeHook('init');
}

module.exports.plugins = [];
module.exports.registerPlugins = registerPlugins;
module.exports.executeHook = executeHook;
