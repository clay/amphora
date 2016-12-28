'use strict';
const _ = require('lodash'),
  control = require('../control'),
  files = require('../files'),
  path = require('path');

/**
 * Normalize path to never end with a slash.
 *
 * @param {string} urlPath
 * @returns {string}
 */
function normalizePath(urlPath) {
  if (!urlPath) {
    return '';
  // make sure path starts with a /
  } else if (_.head(urlPath) !== '/') {
    urlPath = '/' + urlPath;
  }
  // make sure path does not end with a /
  return _.trimEnd(urlPath, '/');
}

/**
 * Normalize directory to never start with slash, never end with slash, and always exist
 * @param {string} dir
 * @returns {string}
 */
function normalizeDirectory(dir) {
  if (!dir || dir === path.sep) {
    dir = '.';
  } else if (_.head(dir) === path.sep) {
    dir = dir.substr(1);
  }

  if (dir.length > 1 && _.last(dir) === path.sep) {
    dir = dir.substring(0, dir.length - 1);
  }

  return dir;
}

/**
 * generate site config map
 * @return {{}}
 */
function getSites() {
  const fullConfig = {},
    instanceSitesFolder = path.resolve('sites');

  files.getFolders(instanceSitesFolder).forEach(function (site) {
    const dir = path.join(instanceSitesFolder, site),
      siteConfig = files.getYaml(path.join(dir, 'config')),
      localConfig = files.getYaml(path.join(dir, 'local'));

    // apply locals over site config
    if (localConfig) {
      _.assign(siteConfig, localConfig);
    }

    // normalize
    siteConfig.slug = site;
    siteConfig.path = normalizePath(siteConfig.path);
    siteConfig.dir = dir;
    siteConfig.assetPath = normalizePath(siteConfig.assetPath);
    siteConfig.assetDir = normalizeDirectory(siteConfig.assetDir || 'public');
    siteConfig.prefix = siteConfig.path && siteConfig.path.length > 1 ? siteConfig.host + siteConfig.path : siteConfig.host;

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

/**
 * Get site from prefix
 * @param {string} prefix
 * @returns {object}
 */
function getSiteFromPrefix(prefix) {
  const split = prefix.split('/', 3),
    site = getSite(split[0], '/' + split[1]);

  // handle sites that have a "subdirectory" path, e.g. /daily/intelligencer
  if (typeof site === 'undefined') {
    return getSite(split[0], '/' + split[1] + '/' + split[2]);
  }
  return site;
}

module.exports.sites = control.memoize(getSites);
module.exports.get = getSite;
module.exports.getSite = getSite;
module.exports.getSiteFromPrefix = getSiteFromPrefix;

// exported for tests
module.exports.normalizePath = normalizePath;
module.exports.normalizeDirectory = normalizeDirectory;
