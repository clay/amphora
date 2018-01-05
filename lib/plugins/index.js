'use strict';

const h = require('highland'),
  _map = require('lodash/map'),
  _isFunction = require('lodash/isFunction'),
  _cloneDeep = require('lodash/cloneDeep'),
  PUB_STREAM = h(),
  SAVE_STREAM = h();

/**
 * Iterate through plugins and try to execute
 * a function exported by any plugin that has
 * been registered.
 *
 * @param  {String} key
 * @param  {Any} args
 */
function executeHook(key, args) {
  _map(module.exports.plugins, (plugin) => {
    var streamApi = `${key}Stream`;

    if (_isFunction(plugin[key])) {
      plugin[key](args);
    }

    // If we have a Stream for this plugin, write to it
    // but clone the ops to prevent bad mutations
    if (h.isStream(plugin[streamApi])) {
      plugin[streamApi].write(_cloneDeep(args));
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
