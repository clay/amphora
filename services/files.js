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

exports.getFolders = getFolders;
exports.getSites = getSites;
exports.getComponents = getComponents;