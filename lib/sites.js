'use strict';
var _ = require('lodash'),
  files = require('./files'),
  path = require('path');

/**
 * Normalize path to always exist, always start with a slash, and never end with a slash.
 *
 * @param {string} path
 * @returns {string}
 */
function normalizePath(path) {
  if (!path) {
    path = '/';
  } else if (_.first(path) !== '/') {
    path = '/' + path;
  } else if (path.length > 1 && _.last(path) === '/') {
    path = path.substring(0, path.length - 2);
  }
  return path;
}

/**
 * Normalize directory to never start with slash, never end with slash, and always exist
 * @param {string} dir
 * @returns {string}
 */
function normalizeDirectory(dir) {
  if (!dir) {
    dir = '.';
  } else if (_.first(dir) === '/') {
    dir = dir.substr(1);
  } else if (dir.length > 1 && _.last(dir) === '/') {
    dir = dir.substring(0, dir.length - 2);
  }
  return dir;
}

/**
 * generate site config map
 * @return {{}}
 */
function getSites() {
  var fullConfig = {},
    instanceSitesFolder = path.resolve('sites');

  files.getFolders(instanceSitesFolder).forEach(function (site) {
    var dirPath = path.join(instanceSitesFolder, site),
      siteConfig = files.getYaml(path.join(dirPath, 'config')),
      localConfig = files.getYaml(path.join(dirPath, 'local'));

    //apply locals over site config
    if (localConfig) {
      _.assign(siteConfig, localConfig);
    }

    //normalize
    siteConfig.slug = site;
    siteConfig.path = normalizePath(siteConfig.path);
    siteConfig.dirPath = normalizeDirectory(dirPath);
    siteConfig.assetPath = normalizePath(siteConfig.assetPath);
    siteConfig.assetDir = normalizeDirectory(siteConfig.assetDir || 'public');

    // check to make sure sites have default properties
    if (!siteConfig.host) {
      throw new Error('Missing host in site config');
    }

    // add site config to the sites map
    fullConfig[siteConfig.slug] = siteConfig;
  });

  return fullConfig;
}

/**
 * generate array of hosts
 * @return {[]}
 */
function getHosts() {
  const sites = getSites(),
    hosts = [];

  // iterate through the sites, generate a list of hosts
  _.each(sites, function (site) {
    if (!_.contains(hosts, site.host)) {
      hosts.push(site.host);
    }
  });

  return hosts;
}

module.exports.sites = _.memoize(getSites);
module.exports.hosts = _.memoize(getHosts);