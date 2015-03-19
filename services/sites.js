'use strict';
var yaml = require('js-yaml'),
  fs = require('fs'),
  _ = require('lodash'),
  log = require('./log'),
  files = require('./files'),
  instanceSitesFolder = __dirname + '/../../../sites/',
  sites = files.getFolders(instanceSitesFolder);

/**
 * generate site config map
 * @return {{}}
 */
function getSites() {
  const fullConfig = {};

  sites.forEach(function (site) {
    let siteConfig = yaml.safeLoad(fs.readFileSync(instanceSitesFolder + site + '/config.yaml', 'utf8'));

    // check to make sure sites have default properties
    if (!siteConfig.slug || !siteConfig.host || !siteConfig.path) {
      log.error('All sites need slug, host, and path!', siteConfig);
      throw new Error('Missing fields');
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