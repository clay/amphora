'use strict';

const path = require('path'),
  files = require('./files'),
  siteService = require('./services/sites'),
  h = require('highland'),
  { parseBootstrap } = require('claycli').import;
var db = require('./services/db'),
  log = require('./services/logger').setup({
    file: __filename,
    action: 'bootstrap'
  });

/**
 * Return a Promise with the contents of a
 * .yaml or .yml file
 *
 * @param {String} filename
 * @returns {Promise}
 */
function readYamlOrYml(filename) {
  return files.readFilePromise(`${filename}.yml`)
    .catch(() => files.readFilePromise(`${filename}.yaml`));
}

/**
 * Return a stream of all component
 * bootstrap files
 *
 * @returns {Stream}
 */
function components() {
  return h(files.getComponents())
    .map(files.getComponentPath)
    .map(getBootstrapFile)
    .merge();
}

/**
 * Return a stream of all layout
 * bootstrap files
 *
 * @returns {Stream}
 */
function layouts() {
  return h(files.getLayouts())
    .map(files.getLayoutPath)
    .map(getBootstrapFile)
    .merge();
}

/**
 * Process each site's bootstrap file
 *
 * @param {Array} sitesArray
 * @returns {Function}
 */
function siteBootstraps(sitesArray) {
  return () => {
    return h(sitesArray)
      .flatMap(site => {
        return getBootstrapFile(site.dir)
          .flatMap(({ yaml, dir}) => {
            return parseBootstrap(yaml, site.prefix)
              .errors((err, push) => {
                let siteBootstrap = dir.split('/');

                log('error', `Error bootstrapping component ${siteBootstrap[splitCmpt.length - 2]}: ${err.message}`);
                push(null, undefined);
              })
              .compact();
          });
      })
      .flatMap(save)
      .collect()
      .toPromise(Promise);
  };
}

/**
 * Process each bootstrap file for all sites
 *
 * @param {Array} sitesArray
 * @returns {Function}
 */
function runBootstrapForAllSites(sitesArray) {
  return (stream) => {
    return stream.flatMap(({ yaml, dir }) => {
      return h(sitesArray)
        .flatMap(({ prefix }) => parseBootstrap(yaml, prefix))
        .errors((err, push) => {
          let splitCmpt = dir.split('/');

          log('error', `Error parsing component bootstrap ${splitCmpt[splitCmpt.length - 2]}, component will not be saved`, {
            message: err.message
          });
          push(null, undefined);
        }).compact();
    });
  };
}

/**
 * Run bootstraps for all the components, layouts
 * and sites in an instance
 *
 * @return {Promise}
 */
function processBootstraps() {
  const sites = siteService.sites(),
    sitesArray = Object.keys(sites).map(site => sites[site]);

  return h([components(), layouts()])
    .merge()
    .through(runBootstrapForAllSites(sitesArray))
    .flatMap(save)
    .collect()
    .toPromise(Promise)
    .then(siteBootstraps(sitesArray));
}

/**
 * Take a dispatch and save it
 *
 * @param {Object} cmpt
 * @returns {Promise}
 */
function save(cmpt) {
  const [ key ] = Object.keys(cmpt);

  return h(db.put(key, cmpt[key]));
}

/**
 * Get the bootstrap file for a directory
 *
 * @param {String} dir
 * @returns {Promise}
 */
function getBootstrapFile(dir) {
  dir = path.resolve(dir);

  if (files.isDirectory(dir)) {
    // default to bootstrap.yaml or bootstrap.yml
    dir = path.join(dir, 'bootstrap');
  }

  return h(readYamlOrYml(dir))
    .map(yaml => ({ dir, yaml }))
    .compact();
}

/**
 * Log the skip of bootstrapping and resolve
 * the bootstrap Promise.
 *
 * @return {Promise}
 */
function skipBootstrap() {
  log('info', 'Skipping bootstrapping sites and components');
  return Promise.resolve();
}

module.exports = function (runBootstrap = true) {
  return runBootstrap ? processBootstraps() : skipBootstrap();
};

// For testing
module.exports.setLog = mock => log = mock;
module.exports.setDb = mock => db = mock;
