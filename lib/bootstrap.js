'use strict';

const path = require('path'),
  files = require('./files'),
  siteService = require('./services/sites'),
  h = require('highland'),
  { parseBootstrap } = require('claycli').import,
  STREAM_MERGE_LIMIT = process.env.AMPHORA_BOOTSTRAP_CONCURRENCY || 10;
var db = require('./services/db'),
  log = require('./services/logger').setup({
    file: __filename,
    action: 'bootstrap'
  });

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
    .mergeWithLimit(STREAM_MERGE_LIMIT);
}

/**
 * Return a stream of all layout
 * bootstrap files
 *
 * @returns {Stream}
 */
// function layouts() {
//   return h(files.getLayouts())
//     .map(files.getLayoutPath)
//     .map(getBootstrapFile)
//     .merge();
// }

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

                log('error', `Error bootstrapping component ${siteBootstrap[siteBootstrap.length - 2]}: ${err.message}`);
                push(null, undefined);
              })
              .compact();
          });
      })
      .map(validateData)
      .map(save)
      .mergeWithLimit(STREAM_MERGE_LIMIT)
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
        .map(({ prefix }) => parseBootstrap(yaml, prefix))
        .mergeWithLimit(STREAM_MERGE_LIMIT)
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

  return h([components()]) // For V7: Add in `layouts()`
    .mergeWithLimit(STREAM_MERGE_LIMIT)
    .through(runBootstrapForAllSites(sitesArray))
    .map(validateData)
    .map(save)
    .mergeWithLimit(STREAM_MERGE_LIMIT)
    .collect()
    .toPromise(Promise)
    .then(siteBootstraps(sitesArray));
}

/**
 * Take an object from claycli and break it apart
 * to be saved, but also make sure it's got valid
 * types for save
 *
 * @param {Object} obj
 * @returns {Object}
 */
function validateData(obj) {
  const [ key ] = Object.keys(obj);
  var value = obj[key];

  // Sometimes bootstraps can be bad and have null data
  if (!value) {
    throw new Error(`Bootstrap contains undefined data for key ${key}`);
  }

  // Uris are not objects
  value = typeof value === 'object' ? JSON.stringify(value) : value;

  return { key, value };
}

/**
 * Take a dispatch and save it
 *
 * @param {Object} cmpt
 * @returns {Promise}
 */
function save({ key, value }) {
  // const [ key ] = Object.keys(cmpt);

  return h(db.put(key, value));
}

/**
 * Get the bootstrap file for a directory
 *
 * @param {String} dir
 * @returns {Promise}
 */
function getBootstrapFile(dir) {
  dir = path.join(path.resolve(dir), 'bootstrap');

  return h(readYamlOrYml(dir))
    .compact()
    .map(yaml => ({ dir, yaml }))
    .compact();
}

/**
 * Return a Promise with the contents of a
 * .yaml or .yml file
 *
 * @param {String} filename
 * @returns {Promise}
 */
function readYamlOrYml(filename) {
  var promise;

  if (files.fileExists(`${filename}.yml`)) {
    promise = files.readFilePromise(`${filename}.yml`);
  } else if (files.fileExists(`${filename}.yaml`)) {
    promise = files.readFilePromise(`${filename}.yaml`);
  } else {
    let splitCmpt = filename.split('/');

    log('warn', `Could not find bootstrap.(yml|yaml) at ${splitCmpt[splitCmpt.length - 2]}, component will not be bootstrapped`);
    promise = Promise.resolve(false);
  }

  return promise;
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

module.exports = (runBootstrap = true) => runBootstrap ? processBootstraps() : skipBootstrap();
// For testing
module.exports.setLog = mock => log = mock;
module.exports.readYamlOrYml = readYamlOrYml;
