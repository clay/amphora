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
  assertions = require('./assertions'),
  log = require('./log');

/**
 *
 * @param {string} ref
 * @param {object} [locals]
 * @returns {*}
 */
function getComponentData(ref, locals) {
  var promise,
    componentName,
    componentModule;

  //assertions
  assertions.exists(ref, 'reference');
  componentName = schema.getComponentNameFromPath(ref);
  assertions.exists(componentName, 'component name', ref);
  componentModule = files.getComponentModule(componentName);

  if (_.isFunction(componentModule)) {
    promise = componentModule(ref, locals);
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
 * List instances within a component
 * @param {string} ref
 * @returns {ReadStream}
 */
function listComponentInstances(ref) {
  assertions.exists(ref, 'reference');
  var componentName = schema.getComponentNameFromPath(ref);
  assertions.exists(componentName, 'component name', ref);

  return db.list({prefix: path, values: false, isArray: false})
    .on('error', function (error) {
      log.warn('listComponentInstances::error', path, error);
    });
}

/**
 * Check component module for list function, otherwise list instances within a component
 * @param {string} ref
 * @param {object} [locals]
 * @returns {*}
 */
function listComponentData(ref, locals) {
  var result,
    componentName = schema.getComponentNameFromPath(ref),
    componentModule = files.getComponentModule(componentName);

  //assertions
  assertions.exists(ref, 'reference');
  assertions.exists(componentName, 'component name', ref);

  if (componentModule && _.isFunction(componentModule.list)) {
    result = componentModule.list(ref, locals);
  } else {
    // default back to db.js, (db takes strings, not objects)
    result = listComponentInstances(ref);
  }

  return result;
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
module.exports.listComponentData = listComponentData;
module.exports.listComponentInstances = listComponentInstances;
module.exports.getSchema = getSchema;
module.exports.getTemplate = getTemplate;