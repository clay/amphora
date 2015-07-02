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
  pkg = require(path.resolve('package.json'));

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
  var deps = pkg.dependencies,
    npmComponents = _(deps).map(function (version, name) {
      return _.contains(name, 'byline-') && name;
    }).compact().value();

  return getFolders(path.resolve('components')).concat(npmComponents);
}

/**
 * get a component name, so we can look it up in the file system
 * internal components and regular npm components should quickly return their names
 * scoped npm components will return the fully-scoped name
 * @param {string} name
 * @returns {string|null}
 */
function getComponentName(name) {
  var allComponents = exports.getComponents(),
    i = 0,
    l = allComponents.length;

  if (_.contains(allComponents, name)) {
    // do a quick check for the component, return quickly if found
    return name;
  } else {
    // the component might be a scoped npm module, do a slower deep check
    for (; i < l; i++) {
      if (_.contains(allComponents[i], name)) {
        return allComponents[i];
      }
    }

    // no matches?
    return null;
  }
}

/**
 * get path to component folder
 * @param  {string} name
 * @return {string}
 */
function getComponentPath(name) {
  var fullName = getComponentName(name);

  // make sure it's a component we have (either in /components or package.json)
  if (!getComponentName(name)) {
    /**
     * Cannot memoize an exception.
     *
     * Also, this isn't a programmer error, unless we're expecting them to check for existence some other way first, so
     * we should not throw an exception.
     */
    return null;
  } else if (fs.existsSync(path.resolve('components', fullName))) {
    return path.resolve('components', fullName);
  } else if (fs.existsSync(path.resolve('node_modules', fullName))) {
    return path.resolve('node_modules', fullName);
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
  var result = _.find(paths, function (path) {
    try {
      result = require(path);
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

// for testing
/**
 * @param {object} newPkg
 */
exports.usePackage = function (newPkg) {
  pkg = newPkg;
};
