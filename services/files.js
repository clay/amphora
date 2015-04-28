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
  path = require('path'),
  log = require('./log'),
  chalk = require('chalk'),
  getFolders, getSites, getComponents;

/**
 * Get folder names.
 *
 * Should only occur once per directory.
 *
 * @param  {string} dir enclosing folder
 * @return {[]}     array of folder names
 */
getFolders = _.memoize(function (dir) {
  if (fs.existsSync(dir)) {
    return fs.readdirSync(dir)
      .filter(function (file) {
        return fs.statSync(path.join(dir, file)).isDirectory();
      });
  } else {
    return [];
  }
});

/**
 * Get array of site names.  Should only occur once.
 * @return {[]}
 */
getSites = _.memoize(function () {
  return getFolders(path.resolve('sites'));
});

/**
 * Get array of component names, from node_modules and components folder.
 *
 * Should only occur once!
 * @return {[]}
 */
getComponents = _.memoize(function () {
  var npmComponents = getFolders(path.resolve('node_modules')).filter(function (name) { return _.contains(name, 'byline-'); });

  return getFolders(path.resolve('components')).concat(npmComponents);
});

/**
 * get path to component folder
 * @param  {string} name
 * @return {string}
 */
function getComponentPath(name) {
  // make sure it's a component we have (either in components or node_modules)
  if (!_.contains(getComponents(), name)) {
    throw new Error(name + ' is not a recognized component!');
  } else if (fs.existsSync(path.resolve('components', name))) {
    return path.resolve('components', name);
  } else if (fs.existsSync(path.resolve('node_modules', name))) {
    return path.resolve('node_modules', name);
  }
}

/**
 * get component name from path
 * @param  {string} filePath
 * @return {string}
 */
function getComponentName(filePath) {
  var nmFolder = 'node_modules' + path.sep,
    cFolder = 'components' + path.sep,
    parentFolder;

  if (_.contains(filePath, nmFolder)) {
    parentFolder = nmFolder;
  } else if (_.contains(filePath, cFolder)) {
    parentFolder = cFolder;
  }

  // get the next folder after the parent folder, e.g. node_modules/<get this>/foo/bar.css
  return filePath.split(parentFolder)[1].split(path.sep)[0];
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
  log.info(chalk.dim('paths ' + paths));
  var result = _.find(paths, function (path) {
    try {
      log.info(chalk.dim('finding ' + name));
      result = require(path);
    } catch (ex) {
      log.info(chalk.dim(name + ' does not exist.'));
      result = false;
    }
    return result;
  });

  if (result) {
    log.info(chalk.dim('result ' + result));
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

exports.getFolders = getFolders;
exports.getSites = getSites;
exports.getComponents = getComponents;
exports.getComponentPath = _.memoize(getComponentPath); //memoize by _first_ parameter only (default)
exports.getComponentName = getComponentName;
exports.getComponentModule = _.memoize(getComponentModule); //memoize by _first_ parameter only (default)
