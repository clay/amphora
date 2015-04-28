'use strict';

var _ = require('lodash'),
  fs = require('fs'),
  path = require('path'),
  knownModules = {},
  getFolders, getSites, getComponents;

/**
 * get folder names
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
 * get array of site names
 * @return {[]}
 */
getSites = function () {
  return getFolders(path.resolve('sites'));
};

/**
 * get array of component names, from node_modules and components folder
 * @return {[]}
 */
getComponents = function () {
  var npmComponents = getFolders(path.resolve('node_modules')).filter(function (name) { return _.contains(name, 'byline-'); });

  return getFolders(path.resolve('components')).concat(npmComponents);
};

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
 * Try to get a module, or return false; remember result in knownModules
 *
 * @param {string} name
 * @param {string} path
 * @returns {object|false}
 */
function tryRequire(name, path) {
  if (knownModules[name] !== false && !knownModules[name]) {
    try {
      knownModules[name] = require(path);
    } catch (ex) {
      //not really an error, since most components will not have server functionality

      //remember that this component does not have server functionality
      knownModules[name] = false;
    }
  }
  return knownModules[name];
}

/**
 * Load a component as a node module.
 *
 * NOTE: This includes local components as well as npm components.
 *
 * @param {string} name
 * @returns {object|false}
 */
function getComponentModule(name) {
  var componentPath = getComponentPath(name);
  return componentPath && (tryRequire(name, componentPath) || tryRequire(name, componentPath + '/server'));
}

exports.getFolders = getFolders;
exports.getSites = getSites;
exports.getComponents = getComponents;
exports.getComponentPath = _.memoize(getComponentPath); //memoize by _first_ parameter only (default)
exports.getComponentName = getComponentName;
exports.getComponentModule = _.memoize(getComponentModule); //memoize by _first_ parameter only (default)