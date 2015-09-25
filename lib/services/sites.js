'use strict';
var _ = require('lodash'),
  files = require('../files'),
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
    var dir = path.join(instanceSitesFolder, site),
      siteConfig = files.getYaml(path.join(dir, 'config')),
      localConfig = files.getYaml(path.join(dir, 'local'));

    //apply locals over site config
    if (localConfig) {
      _.assign(siteConfig, localConfig);
    }

    //normalize
    siteConfig.slug = site;
    siteConfig.path = normalizePath(siteConfig.path);
    siteConfig.dir = dir;
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

/**
 * get site config that matches a specific host + path
 * @param {string} host
 * @param {string} path (make sure it starts with a slash!)
 * @returns {object}
 */
function getSite(host, path) {
  // note: uses the memoized version
  return _.find(module.exports.sites(), function (site) {
    return site.host === host && site.path === path;
  });
}

module.exports.sites = _.memoize(getSites);
module.exports.hosts = _.memoize(getHosts);
module.exports.get = getSite;
