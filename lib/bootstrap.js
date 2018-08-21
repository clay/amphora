'use strict';

const bluebird = require('bluebird'),
  path = require('path'),
  files = require('./files'),
  siteService = require('./services/sites'),
  { parseBootstrap } = require('claycli').import;
var db = require('./services/db'),
  log = require('./services/logger').setup({
    file: __filename,
    action: 'bootstrap'
  });

/**
 * Return a stream of all component
 * bootstrap files
 *
 * @param {Array} sitesArray
 * @returns {Promise}
 */
function components(sitesArray) {
  return bluebird.map(files.getComponents().map(files.getComponentPath), getBootstrapFile, { concurrency: 10 })
    .then(resp => resp.filter(item => !!item))
    .then(items => makeAllOps(items, sitesArray))
    .then(bootstrapForEachSite)
    .then(save);
}

function bootstrapSites(sitesArray) {
  // let siteBootstrap = dir.split('/');

  // log('error', `Error bootstrapping component ${siteBootstrap[siteBootstrap.length - 2]}: ${err.message}`);
  return bluebird.map(sitesArray, ({ dir, prefix }) => {
    return getBootstrapFile(dir)
      .then(({ yaml }) => yamlToJson(yaml, prefix).then(resp => [validateData(resp)]))
      .then(resp => resp.filter(item => !!item))
      .then(save);
  }, { concurrency: 5 });
}

/**
 * Convert a yaml string to JSON using
 * claycli to make the objects
 *
 * @param {String} yaml
 * @param {String} prefix
 * @returns {Promise}
 */
function yamlToJson(yaml, prefix) {
  return parseBootstrap(yaml, prefix)
    .collect()
    .toPromise(bluebird);
}

/**
 * Iterate through all sites and all yaml
 * files and make an op for each file for
 * each site
 *
 * @param {Array} items
 * @param {Array} sitesArray
 * @returns {Array}
 */
function makeAllOps(items, sitesArray) {
  const ops = [];

  for (let i = 0; i < sitesArray.length; i++) {
    let { prefix } = sitesArray[i];

    for (let j = 0; j < items.length; j++) {
      const item = items[j];

      item.prefix = prefix;
      ops.push(item);
    }
  }

  return ops;
}

function bootstrapForEachSite(items) {
  return bluebird.map(items, ({ yaml, prefix }) => yamlToJson(yaml, prefix).then(validateData), { concurrency: 25 });
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

  return components(sitesArray)
    .then(() => bootstrapSites(sitesArray));
}

/**
 * Take an object from claycli and break it apart
 * to be saved, but also make sure it's got valid
 * types for save
 *
 * @param {Array} objs
 * @returns {Array}
 */
function validateData(objs) {
  return objs.map(obj => {
    const [ key ] = Object.keys(obj);
    var value = obj[key];

    // Sometimes bootstraps can be bad and have null data
    if (!value) {
      throw new Error(`Bootstrap contains undefined data for key ${key}`);
    }

    // Uris are not objects
    value = typeof value === 'object' ? JSON.stringify(value) : value;

    return { key, value };
  });
}

/**
 * Take a dispatch and save it
 *
 * @param {Array} ops
 * @returns {Promise}
 */
function save(ops) {
  // let splitCmpt = dir.split('/');
  // log('error', `Error parsing component bootstrap ${splitCmpt[splitCmpt.length - 2]}, component will not be saved`, {
  //   message: err.message
  // });

  return bluebird.map(ops, opArr => {
    return bluebird.all(opArr.map(({ key, value}) => db.put(key, value)));
  }, { concurrency: 20 });
}

/**
 * Get the bootstrap file for a directory
 *
 * @param {String} dir
 * @returns {Promise}
 */
function getBootstrapFile(dir) {
  dir = path.join(path.resolve(dir), 'bootstrap');

  return readYamlOrYml(dir)
    .then(yaml => {
      if (!yaml) return undefined;

      return { dir, yaml };
    });
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
