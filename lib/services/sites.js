'use strict';

const _ = require('lodash'),
  files = require('../files'),
  path = require('path');
var log = require('./logger').setup({
  file: __filename
});

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

    if (!siteConfig) {
      log('warn', `No site config file found for site '${site}', please make sure one is included`);
      return;
    }

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

    if (!siteConfig.protocol) {
      log('warn', `A protocol property ('http' or 'https') was not found for site '${site}', it will default to 'http'`);
      siteConfig.protocol = 'http';
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
 * Get the site a URI belongs to
 *
 * @param {string} prefix
 * @returns {object}
 */
function getSiteFromPrefix(prefix) {
  var split = prefix.split('/'), // Split the url/uri by `/`
    host = split.shift(),        // The first value should be the host ('http://' is not included)
    optPath = split.shift(),  // The next value is the first part of the site's path OR the whole part
    path = optPath ? `/${optPath}` : '',
    length = split.length + 1,   // We always need at least one pass through the for loop
    site;                        // Initialize the return value to `undefined`

  for (let i = 0; i < length; i++) {
    site = getSite(host, path); // Try to get the site based on the host and path

    if (site) { // If a site was found, break out of the loop
      break;
    } else {
      path += `/${split.shift()}`; // Grab the next value and append it to the `path` value
    }
  }

  return site; // Return the site
}

module.exports.sites = _.memoize(getSites);
module.exports.get = getSite;
module.exports.getSite = getSite;
module.exports.getSiteFromPrefix = getSiteFromPrefix;

// exported for tests
module.exports.normalizePath = normalizePath;
module.exports.normalizeDirectory = normalizeDirectory;
module.exports.setLog = mock => log = mock;