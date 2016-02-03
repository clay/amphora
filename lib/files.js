/**
 * File-system use goes here.
 *
 * We should try to reduce these, so logging when it happens is useful.
 *
 * It's also useful to mock it away in other components.
 */

'use strict';

var _ = require('lodash'),
  control = require('./control'),
  fs = require('fs'),
  path = require('path'),
  yaml = require('js-yaml'),
  pkg = require(path.resolve('package.json')),
  temp2env = require('template2env'),
  req = require,
  allowedEnvFiles = ['local', 'config'];

/**
 * @param {string} filename
 * @returns {string}
 */
function fileExists(filename) {
  try {
    return !!fs.statSync(filename);
  } catch (ex) {
    return false;
  }
}

/**
 * @param {string} filename
 * @returns {string}
 */
function readFile(filename) {
  try {
    return fs.readFileSync(filename, 'utf8');
  } catch (ex) {
    return null;
  }
}

/**
 * @param {string} file
 * @returns {boolean}
 */
function isDirectory(file) {
  try {
    return fs.statSync(file).isDirectory();
  } catch (ex) {
    return false;
  }
}

/**
 *
 * @param {string} dir
 * @returns {Array}
 */
function getFiles(dir) {
  try {
    return fs.readdirSync(dir)
      .filter(function (file) {
        return !exports.isDirectory(path.join(dir, file)) &&
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
        return exports.isDirectory(path.join(dir, file));
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
      if (_.contains(name, 'clay-')) {
        // this is a clay component
        if (_.contains(name, path.sep)) {
          // this is a scoped npm component!
          // return the name without the scope/user
          return name.split(path.sep)[1];
        } else {
          // this is an unscoped npm component
          return name;
        }
      } // otherwise returns undefined, and is compacted below
    }).compact().value();

  return getFolders(path.resolve('components')).concat(npmComponents);
}

/**
 * Get a component name, so we can look it up in the file system.
 *
 * @param {string} name
 * @returns {string|false}
 */
function getComponentName(name) {
  var allComponents = exports.getComponents();

  return _.contains(allComponents, name) && name;
}

/**
 * Get the full name of a possibly-scoped npm component
 *
 * @param {string} name, e.g. 'clay-header'
 * @returns {string|undefined} e.g. '@nymdev/clay-header'
 */
function getScopedModuleName(name) {
  return _.findKey(pkg.dependencies, function (version, dep) {
    return _.contains(dep, name);
  });
}

/**
 * Get path to component folder.
 *
 * @param  {string} name
 * @return {string}
 */
function getComponentPath(name) {
  var result = null,
    modulePath, npmName;

  // make sure it's a component we have (either in /components or package.json)
  if (getComponentName(name)) {
    modulePath = path.resolve('components', name);

    if (fs.existsSync(modulePath)) {
      result = modulePath;
    } else {
      npmName = getScopedModuleName(name);
      modulePath = npmName && path.resolve('node_modules', npmName);
      result = modulePath;
    }
  }

  return result;
}

/**
 * Try to require a module, do not fail if module is missing
 * @param {string} filePath
 * @returns {module}
 * @throw if fails for reason other than missing module
 */
function tryRequire(filePath) {
  var result;

  try {
    result = req(filePath);
  } catch (ex) {
    if (ex.message && !ex.message.match(/Cannot find module/i)) {
      throw ex;
    }
  }

  return result;
}

/**
 * Try to get a module, or return false.
 *
 * @param {[string]} paths  Possible paths to find their module.
 * @returns {object|false}
 */
function tryRequireEach(paths) {
  var result;

  while (!result && paths.length) {
    result = tryRequire(paths.shift());
  }

  return result;
}

/**
 * @param {Array} value
 */
function setAllowedEnvFiles(value) {
  allowedEnvFiles = value;
}

/**
 * @return {Array}
 */
function getAllowedEnvFiles() {
  return allowedEnvFiles;
}

/**
 * @param {string} filename
 * @returns {string}
 */
function getYaml(filename) {
  const data = readFile(filename + '.yaml') || readFile(filename + '.yml'),
    basename = path.basename(filename, path.extname(filename));

  if (_.contains(allowedEnvFiles, basename)) {
    // if filename is a config or local file
    // parse yaml for env variables
    return yaml.safeLoad(temp2env.interpolate(data));
  } else {
    return yaml.safeLoad(data);
  }
}

/**
 * @param {object} value
 */
function setPackageConfiguration(value) {
  pkg = value;
}

/**
 * @param {function} value
 */
function setRequire(value) {
  req = value;
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
  var componentPath = exports.getComponentPath(name);
  return componentPath && tryRequireEach([componentPath, componentPath + '/server']);
}

/**
 * Load a component's package
 *
 * Should only occur once per name!
 *
 * NOTE: This includes local components as well as npm components
 *
 * @param {string} name
 * @returns {object|false}
 */
function getComponentPackage(name) {
  var componentPath = exports.getComponentPath(name);
  return componentPath && tryRequireEach([componentPath + '/package.json']);
}

exports.getYaml = control.memoize(getYaml);
exports.getFiles = control.memoize(getFiles);
exports.getFolders = control.memoize(getFolders);
exports.fileExists = control.memoize(fileExists);
exports.getComponents = control.memoize(getComponents);
exports.getComponentPath = control.memoize(getComponentPath);
exports.getComponentModule = control.memoize(getComponentModule);
exports.getComponentPackage = control.memoize(getComponentPackage);
exports.isDirectory = control.memoize(isDirectory);
exports.tryRequire = control.memoize(tryRequire);

// for testing
exports.setPackageConfiguration = setPackageConfiguration;
exports.setRequire = setRequire;
exports.setAllowedEnvFiles = setAllowedEnvFiles;
exports.getAllowedEnvFiles = getAllowedEnvFiles;
