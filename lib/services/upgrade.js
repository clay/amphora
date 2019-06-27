/* eslint max-params: [2, 5] */
'use strict';

const _ = require('lodash'),
  bluebird = require('bluebird'),
  files = require('../files'),
  path = require('path'),
  utils = require('../utils/schema'),
  { getComponentName, getLayoutName, isComponent } = require('clayutils');
var db = require('./db'),
  log = require('./logger').setup({
    file: __filename,
    action: 'upgrade'
  });

/**
 * Just do a quick sort, lowest to highest.
 *
 * @param  {Number} a
 * @param  {Number} b
 * @return {Number}
 */
function sortNumber(a, b) {
  return a - b;
}

/**
 * Make an array of version numbers (that can include a decimal)
 * and order them from least to greatest. The numbers are derived
 * from the keys of the upgrade module that is required in.
 *
 * @param  {Object} upgrade
 * @return {Array}
 */
function generateVersionArray(upgrade) {
  return _.map(_.keys(upgrade), function (version) {
    return parseFloat(version);
  }).sort(sortNumber);
}

/**
 * Iterate through the array of version transforms provided
 * and determine which versions are valid to be run.
 *
 * - If the data has no current version but the schema declares
 * one, then run it
 * - If the current schema version is greater than the current
 * version AND the tranform version is greater than the current
 * version, run it.
 *
 * @param  {Number} schemaVersion
 * @param  {Number} currentVersion
 * @param  {Object} upgradeFile
 * @return {Array}
 */
function aggregateTransforms(schemaVersion, currentVersion, upgradeFile) {
  var transformVersions = generateVersionArray(upgradeFile),
    applicableVersions = [];

  for (let i = 0; i < transformVersions.length; i++) {
    let version = transformVersions[i];

    if (!currentVersion && schemaVersion || schemaVersion >= version && version > currentVersion) {
      applicableVersions.push(transformVersions[i]);
    }
  }

  return applicableVersions;
}

/**
 * We have a the transforms we need to perform, so let's
 * reduce them into the final data object.
 *
 * @param  {Array}   transforms
 * @param  {Object}  upgradeFile
 * @param  {String}  ref
 * @param  {Object}  data
 * @param  {Object}  locals
 * @return {Promise}
 */
function runTransforms(transforms, upgradeFile, ref, data, locals) {
  log('debug', `Running ${transforms.length} transforms`);
  return bluebird.reduce(transforms, function (acc, val) {
    var key = val.toString();

    // Parsefloat strips decimals with `.0` leaving just the int,
    // let's add them back in
    if (!_.includes(key, '.')) {
      key += '.0';
    }

    return bluebird.try(upgradeFile[key].bind(null, ref, acc, locals))
      .catch(e => {
        log('error', `Error upgrading ${ref} to version ${key}: ${e.message}`, {
          errStack: e.stack,
          cmptData: JSON.stringify(acc)
        });
        return bluebird.reject(e);
      });
  }, data)
    .then(function (resp) {
      // Assign the version number automatically
      resp._version = transforms[transforms.length - 1];
      return resp;
    });
}

/**
 * The data that was upgraded needs to be saved so that
 * we never need to upgrade again. Send it to the DB before
 * returning that data.
 *
 * @param  {String} uri
 * @return {Function}
 */
function saveTransformedData(uri) {
  return function (data) {
    return db.put(uri, JSON.stringify(data))
      .then(function () {
        // If the Promise resolves it means we saved,
        // so let's return the data
        return data;
      });
  };
}



/**
 * We know a upgrade needs to happen, so let's kick it off. If
 * there is no upgrade file, return early cause we can't do anything.
 *
 * If it exists though, we need to find which transforms to perform,
 * make them happen, save that new data and then send it back
 *
 * @param  {Number} schemaVersion
 * @param  {Number} dataVersion
 * @param  {String} ref
 * @param  {Object} data
 * @param  {Object} locals
 * @return {Promise}
 */
function upgradeData(schemaVersion, dataVersion, ref, data, locals) {
  const name = isComponent(ref) ? getComponentName(ref) : getLayoutName(ref),
    dir = isComponent(ref) ? files.getComponentPath(name) : files.getLayoutPath(name), // Get the component directory
    upgradeFile = files.tryRequire(path.resolve(dir, 'upgrade')); // Grab the the upgrade.js file

  var transforms = [];


  log('debug', `Running upgrade for ${name}: ${ref}`);
  // If no upgrade file exists, exit early
  if (!upgradeFile) {
    log('debug', `No upgrade file found for component: ${name}`);
    return bluebird.resolve(data);
  }

  // find all the transforms that have to be performed (object.keys)
  transforms = aggregateTransforms(schemaVersion, dataVersion, upgradeFile);

  // If no transforms need to be run, exit early
  if (!transforms.length) {
    log('debug', `Upgrade tried to run, but no upgrade function was found for ${name}`, {
      component: name,
      currentVersion: dataVersion,
      schemaVersion
    });
    return bluebird.resolve(data);
  }

  // pass through the transform
  return runTransforms(transforms, upgradeFile, ref, data, locals)
    .then(saveTransformedData(ref))
    .catch(e => {
      throw e;
    });
}

/**
 * Grab the schema for the component and check if the schema
 * and data versions do not match. If they do we don't need
 * to do anything, otherwise the upgrade process needs to be
 * kicked off.
 *
 * @param  {String} ref
 * @param  {Object} data
 * @param  {Object} locals
 * @return {Promise}
 */
function checkForUpgrade(ref, data, locals) {
  return utils.getSchema(ref)
    .then(schema => {
      // If version does not match what's in the data
      if (schema && schema._version && schema._version !== data._version) {
        return module.exports.upgradeData(schema._version, data._version, ref, data, locals);
      }

      return bluebird.resolve(data);
    });
}

/**
 * Upgrade entry point for passing in the ref and locals.
 *
 * @param  {Object} ref
 * @param  {Object} locals
 * @return {Function}
 */
function upgrade(ref, locals) {
  return function (data) {
    return checkForUpgrade(ref, data, locals);
  };
}

module.exports.init = upgrade;
module.exports.upgradeData = upgradeData;

// For testing
module.exports.checkForUpgrade = checkForUpgrade;
module.exports.generateVersionArray = generateVersionArray;
module.exports.aggregateTransforms = aggregateTransforms;
module.exports.setLog = mock => log = mock;
module.exports.setDb = mock => db = mock;
