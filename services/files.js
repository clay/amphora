'use strict';

var _ = require('lodash'),
  fs = require('fs'),
  path = require('path'),
<<<<<<< Updated upstream
  knownModules = {},
  log = require('./log'),
  chalk = require('chalk'),
=======
>>>>>>> Stashed changes
  getFolders, getSites, getComponents;

/**
 * get folder names
 * @param  {string} dir enclosing folder
 * @return {[]}     array of folder names
 */
getFolders = _.memoize(function (dir) {
<<<<<<< Updated upstream
  if (fs.existsSync(dir)) {
    return fs.readdirSync(dir)
      .filter(function (file) {
        return fs.statSync(path.join(dir, file)).isDirectory();
      });
  } else {
    return [];
  }
=======
  return fs.readdirSync(dir).filter(function (file) {
    return fs.statSync(path.join(dir, file)).isDirectory();
  });
>>>>>>> Stashed changes
});

/**
 * get array of site names
 * @return {[]}
 */
<<<<<<< Updated upstream
getSites = function () {
  return getFolders(path.resolve('sites'));
};
=======
getSites = _.memoize(function () {
  return getFolders('sites');
});
>>>>>>> Stashed changes

/**
 * get array of component names, from node_modules and components folder
 * @return {[]}
 */
<<<<<<< Updated upstream
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
 * Load a component as a node module.
 *
 * NOTE: This includes local components as well as npm components.
 *
 * @param {string} name
 * @returns {object|false}
 */
function getComponentModule(name) {
  if (!knownModules[name] && knownModules[name] !== false) {
    //load and return it
    try {
      var componentPath = getComponentPath(name);
      log.info(chalk.italic.dim('Loading server module ' + componentPath));
      knownModules[name] = require(componentPath);
    } catch (ex) {
      //not really an error, since most components will not have server functionality
      log.info(chalk.italic.dim('Did not load/find a server module for ' + name + ': ' + ex.message));

      //remember that this component does not have server functionality
      knownModules[name] = false;
    }
  }

  return knownModules[name];
}

exports.getFolders = getFolders;
exports.getSites = getSites;
exports.getComponents = getComponents;
exports.getComponentPath = getComponentPath;
exports.getComponentName = getComponentName;
exports.getComponentModule = getComponentModule;
=======
getComponents = _.memoize(function () {
  var npmComponents = getFolders('node_modules').filter(function (name) { return _.contains(name, 'byline-'); });

  return getFolders('components').concat(npmComponents);
});

exports.getFolders = getFolders;
exports.getSites = getSites;
exports.getComponents = getComponents;
>>>>>>> Stashed changes
