'use strict';

var _ = require('lodash'),
  fs = require('fs'),
  path = require('path'),
  cwd = process.cwd(),
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
  return getFolders(cwd + '/sites');
};

/**
 * get array of component names, from node_modules and components folder
 * @return {[]}
 */
getComponents = function () {
  var npmComponents = getFolders(cwd + '/node_modules').filter(function (name) { return _.contains(name, 'byline-'); });

  return getFolders(cwd + '/components').concat(npmComponents);
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
  } else if (fs.existsSync(cwd + '/components/' + name)) {
    return cwd + '/components/' + name;
  } else if (fs.existsSync(cwd + '/node_modules/' + name)) {
    return cwd + '/node_modules/' + name;
  }
}

/**
 * get component name from path
 * @param  {string} filePath
 * @return {string}
 */
function getComponentName(filePath) {
  var parentFolder;

  if (_.contains(filePath, 'node_modules/')) {
    parentFolder = 'node_modules' + path.sep;
  } else if (_.contains(filePath, 'components/')) {
    parentFolder = 'components' + path.sep;
  }

  // get the next folder after the parent folder, e.g. node_modules/<get this>/foo/bar.css
  return filePath.split(parentFolder)[1].split('/')[0];
}

exports.getFolders = getFolders;
exports.getSites = getSites;
exports.getComponents = getComponents;
exports.getComponentPath = getComponentPath;
exports.getComponentName = getComponentName;