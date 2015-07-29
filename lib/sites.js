'use strict';
var yaml = require('js-yaml'),
  fs = require('fs'),
  _ = require('lodash'),
  log = require('./log'),
  files = require('./files'),
  path = require('path'),
  instanceSitesFolder = path.resolve('sites');

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
 * @param {string} filename
 * @returns {string}
 */
function safeReadFile(filename) {
  try {
    return fs.readFileSync(filename, 'utf8');
  } catch (ex) {
    return null;
  }
}

/**
 * @param {string} filename
 * @returns {string}
 */
function getYaml(filename) {
  return yaml.safeLoad(safeReadFile(filename + '.yaml') || safeReadFile(filename + '.yml'));
}

/**
 * generate site config map
 * @return {{}}
 */
function getSites() {
  var fullConfig = {};

  files.getFolders(instanceSitesFolder).forEach(function (site) {
    var dirPath = path.join(instanceSitesFolder, site),
      siteConfig = getYaml(path.join(dirPath, 'config')),
      localConfig = getYaml(path.join(dirPath, 'local'));

    //apply locals over site config
    if (localConfig) {
      _.assign(siteConfig, localConfig);
    }

    //normalize
    siteConfig.slug = site;
    siteConfig.path = normalizePath(siteConfig.path);

    // check to make sure sites have default properties
    if (!siteConfig.host) {
      log.error('All sites need a host', siteConfig);
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
  _.map(sites, function (site) {
    if (!_.contains(hosts, site.host)) {
      hosts.push(site.host);
    }
  });

  return hosts;
}

module.exports.sites = _.memoize(getSites);
module.exports.hosts = _.memoize(getHosts);
module.exports.sitesFolder = instanceSitesFolder;