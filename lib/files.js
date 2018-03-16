/**
 * File-system use goes here.
 *
 * We should try to reduce these, so logging when it happens is useful.
 *
 * It's also useful to mock it away in other components.
 */

'use strict';

let _ = require('lodash'),
  fs = require('fs'),
  path = require('path'),
  yaml = require('js-yaml'),
  { getComponents, getComponentPath } = require('amphora-fs'),
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
        return module.exports.isDirectory(path.join(dir, file));
      });
  } catch (ex) {
    return [];
  }
}

/**
 * Try to require a module, do not fail if module is missing
 * @param {string} filePath
 * @returns {module}
 * @throw if fails for reason other than missing module
 */
function tryRequire(filePath) {
  let resolvedPath;

  try {
    resolvedPath = req.resolve(filePath);
  } catch (ex) {
    return undefined;
  }
  return req(resolvedPath);
}

/**
 * Try to get a module, or return false.
 *
 * @param {[string]} paths  Possible paths to find their module.
 * @returns {object|false}
 */
function tryRequireEach(paths) {
  let result;

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

  if (_.includes(allowedEnvFiles, basename)) {
    // if filename is a config or local file
    // parse yaml for env variables
    return yaml.safeLoad(temp2env.interpolate(data));
  }

  return yaml.safeLoad(data);
}

/**
 * @param {function} value
 */
function setRequire(value) {
  req = value;
}

/**
 * Load a component model
 *
 * NOTE: This includes local components as well as npm components.
 *
 * @param {string} name
 * @param {string} [prefix]
 * @returns {object|false}
 */
function getComponentModule(name, prefix) {
  var componentPath;

  if (prefix === 'html') {
    return false;
  }

  componentPath = module.exports.getComponentPath(name);

  return componentPath && tryRequire(`${componentPath}/${prefix ? `${prefix}.` : ''}model`);
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
  let componentPath = module.exports.getComponentPath(name);

  return componentPath && tryRequireEach([componentPath + '/package.json']);
}

/**
 * Returns a promise representing the retrieval of content from a file
 *
 * @param  {string} file A filename
 * @return {Promise}
 */
function readFilePromise(file) {
  return new Promise((resolve, reject) => {
    fs.readFile(file, 'utf8', (err, data) => {
      if (err) {
        reject(err);
      }
      resolve(data);
    });
  });
}

exports.getYaml = _.memoize(getYaml);
exports.getFiles = _.memoize(getFiles);
exports.getFolders = _.memoize(getFolders);
exports.fileExists = _.memoize(fileExists);
exports.getComponents = getComponents; // Memoized in the package so other packages in the same instance get the benefits
exports.getComponentPath = _.memoize(getComponentPath);
exports.getComponentModule = _.memoize(getComponentModule, (name, prefix) => `${name}${prefix ? `|${prefix}` : ''}`);
exports.getComponentPackage = _.memoize(getComponentPackage);
exports.isDirectory = _.memoize(isDirectory);
exports.tryRequire = _.memoize(tryRequire);
exports.readFilePromise = _.memoize(readFilePromise);

// for testing
exports.setRequire = setRequire;
exports.setAllowedEnvFiles = setAllowedEnvFiles;
exports.getAllowedEnvFiles = getAllowedEnvFiles;
