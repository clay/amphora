'use strict';

/**
 * All of these function get or set from a reference path.
 *
 * @class
 */

var config = require('config'),
  _ = require('lodash'),
  db = require('./db'),
  schema = require('./schema'),
  files = require('./files'),
  path = require('path'),
  glob = require('glob'),
  bluebird = require('bluebird'),
  assertions = require('./assertions');

/**
 *
 * @param {string} ref
 * @returns {*}
 */
function getComponentData(ref) {
  var promise,
    componentName = schema.getComponentNameFromPath(ref),
    componentModule = files.getComponentModule(componentName);

  //assertions
  assertions.exists(ref, 'reference');
  assertions.exists(componentName, 'component name', ref);

  if (_.isFunction(componentModule)) {
    promise = componentModule(ref);
  } else {
    // default back to db.js (objects are stored as strings, not objects)
    promise = db.get(ref).then(JSON.parse);
  }

  assertions.isPromise(promise, ref);

  return promise;
}

/**
 *
 * @param {string} ref
 * @param {object} data
 * @returns {*}
 */
function putComponentData(ref, data) {
  var promise,
    componentName = schema.getComponentNameFromPath(ref),
    componentModule = files.getComponentModule(componentName);

  //assertions
  assertions.exists(ref, 'reference');
  assertions.exists(componentName, 'component name', ref);

  if (componentModule && _.isFunction(componentModule.put)) {
    promise = componentModule.put(ref);
  } else {
    // default back to db.js, (db takes strings, not objects)
    promise = db.put(ref, JSON.stringify(data));
  }

  return promise;
}

/**
 *
 * @param {string} ref
 */
function getSchema(ref) {
  return bluebird.try(function () {
    var componentName = schema.getComponentNameFromPath(ref);

    assertions.exists(ref, 'reference');
    assertions.exists(componentName, 'component name', ref);

    return schema.getSchema(files.getComponentPath(componentName));
  });
}

/**
 *
 * @param {string} ref
 * @returns {*}
 */
function getTemplate(ref) {
  assertions.exists(ref, 'reference');

  // if there are slashes in this name, they've given us a reference like /components/name/instances/id
  if (ref.indexOf('/') !== -1) {
    ref = schema.getComponentNameFromPath(ref);
    assertions.exists(ref, 'component name', ref);
  }

  var filePath = files.getComponentPath(ref),
    possibleTemplates;

  if (_.contains(filePath, 'node_modules')) {
    possibleTemplates = [path.join(filePath, require(filePath + '/package.json').template)];
  } else {
    filePath = path.join(filePath, config.get('names.template'));
    possibleTemplates = glob.sync(filePath + '.*');
  }

  if (!possibleTemplates.length) {
    throw new Error('No template files found for ' + filePath);
  }

  // return the first template found
  return possibleTemplates[0];
}

module.exports.getComponentData = getComponentData;
module.exports.putComponentData = putComponentData;
module.exports.getSchema = getSchema;
module.exports.getTemplate = getTemplate;