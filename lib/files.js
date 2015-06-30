/**
 * File-system use goes here.
 *
 * We should try to reduce these, so logging when it happens is useful.
 *
 * It's also useful to mock it away in other components.
 */

'use strict';

var _ = require('lodash'),
  fs = require('fs'),
  path = require('path');

/**
 *
 * @param {string} dir
 * @returns {Array}
 */
function getFiles(dir) {
  try {
    return fs.readdirSync(dir)
      .filter(function (file) {
        return !fs.statSync(path.join(dir, file)).isDirectory() &&
          file.indexOf('.test.') === -1 && // ignore test files
          file.indexOf('.md') === -1; // ignore documentation files
      });
  } catch (ex) {
    return [];
  }
}

/**
 * Get folder names.
 *
 * Should only occur once per directory.
 *
 * @param  {string} dir enclosing folder
 * @return {[]}     array of folder names
 */
function getFolders(dir) {
  try {
    return fs.readdirSync(dir)
      .filter(function (file) {
        return fs.statSync(path.join(dir, file)).isDirectory();
      });
  } catch (ex) {
    return [];
  }
}

/**
 * Get array of component names, from node_modules and components folder.
 *
 * Should only occur once!
 * @return {[]}
 */
function getComponents() {
  var npmComponents = getFolders(path.resolve('node_modules')).filter(function (name) {
    return _.contains(name, 'byline-');
  });

  return getFolders(path.resolve('components')).concat(npmComponents);
}

/**
 * get path to component folder
 * @param  {string} name
 * @return {string}
 */
function getComponentPath(name) {
  // make sure it's a component we have (either in components or node_modules)
  if (!_.contains(exports.getComponents(), name)) {
    /**
     * Cannot memoize an exception.
     *
     * Also, this isn't a programmer error, unless we're expecting them to check for existence some other way first, so
     * we should not throw an exception.
     */
    return null;
  } else if (fs.existsSync(path.resolve('components', name))) {
    return path.resolve('components', name);
  } else if (fs.existsSync(path.resolve('node_modules', name))) {
    return path.resolve('node_modules', name);
  }
}

/**
 * Try to get a module, or return false.
 *
 * Should only occur once per name!
 *
 * @param {string} name
 * @param {[string]} paths  Possible paths to find their module.
 * @returns {object|false}
 */
function tryRequire(name, paths) {
  var result = _.find(paths, function (filePath) {
    try {
      result = require(filePath);
    } catch (ex) {
      if (ex.message && !ex.message.match(/Cannot find module/i)) {
        throw ex;
      }
      result = false;
    }
    return result;
  });

  if (result) {
    result = require(result);
  }

  return result;
}

/**
 * Load a component as a node module.
 *
 * Should only occur once per name!
 *
 * NOTE: This includes local components as well as npm components.
 *
 * @param {string} name
 * @returns {object|false}
 */
function getComponentModule(name) {
  var componentPath = getComponentPath(name);

  return componentPath && tryRequire(name, [componentPath, componentPath + '/server']);
}

exports.getFiles = _.memoize(getFiles);
exports.getFolders = _.memoize(getFolders);
exports.getComponents = _.memoize(getComponents);
exports.getComponentPath = _.memoize(getComponentPath); // memoize by _first_ parameter only (default)
exports.getComponentModule = _.memoize(getComponentModule); // memoize by _first_ parameter only (default)
