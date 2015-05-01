'use strict';

/**
 * All of these function get or set from a reference path.
 *
 * That is, each call is literally `someMethod(referencePath);`
 *
 * @module
 */

var config = require('config'),
  _ = require('lodash'),
  db = require('./db'),
  schema = require('./schema'),
  files = require('./files'),
  path = require('path'),
  glob = require('glob'),
  bluebird = require('bluebird'),
  is = require('./assert-is'),
  log = require('./log');

/**
 * Takes a ref, and returns the component name within it.
 * @param {string} ref
 * @returns {string}
 * @example /components/base  returns base
 * @example /components/text/instances/0  returns text
 * @example /components/image.html  returns image
 */
function getComponentName(ref) {
  var result = /components\/(.+?)[\/\.]/.exec(ref) || /components\/(.+)/.exec(ref);

  return result && result[1];
}

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
  is(ref, 'reference');
  componentName = getComponentName(ref);
  is(componentName, 'component name', ref);
  componentModule = files.getComponentModule(componentName);

  if (_.isFunction(componentModule)) {
    promise = componentModule(ref, locals);
  } else {
    // default back to db.js (objects are stored as strings, not objects)
    promise = db.get(ref).then(JSON.parse);
  }

  return is.promise(promise, ref);
}

/**
 *
 * @param {string} ref
 * @param {object} data
 * @returns {*}
 */
function putComponentData(ref, data) {
  var promise, componentModule, componentName;

  //assertions
  is(ref, 'reference');
  componentName = getComponentName(ref);
  is(componentName, 'component name', ref);
  componentModule = files.getComponentModule(componentName);

  if (componentModule && _.isFunction(componentModule.put)) {
    promise = componentModule.put(ref);
  } else {
    // default back to db.js, (db takes strings, not objects)
    promise = db.put(ref, JSON.stringify(data));
  }

  return promise;
}

/**
 * List instances within a component.
 * @param {string} ref
 * @throws if not a component reference
 * @returns {ReadStream}
 */
function listComponentInstances(ref) {
  is(ref, 'reference');
  is(getComponentName(ref), 'component name', ref);

  return db.list({prefix: ref, values: false, isArray: false})
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
    componentName = getComponentName(ref),
    componentModule = files.getComponentModule(componentName);

  //assertions
  is(ref, 'reference');
  is(componentName, 'component name', ref);

  if (componentModule && _.isFunction(componentModule.list)) {
    result = componentModule.list(ref, locals);
  } else {
    // default back to db.js, (db takes strings, not objects)
    result = listComponentInstances(ref);
  }

  return result;
}

/**
 * Consistent way to get page data by reference.  Validation of page can go here.
 * @param {string} ref
 * @returns {Promise.object}
 */
function getPageData(ref) {
  is('page reference', ref);
  is.string.match(ref, /^\/pages\/.*/); //case matters, only beginning of string

  return db.get(ref)
    .then(JSON.parse);
}

/**
 * Consistent way to put page data.  Validation of page can go here.
 * @param ref
 * @param data
 * @returns {Promise.object}
 */
function putPageData(ref, data) {
  is(ref, 'page reference');
  is.string.match(ref, /^\/pages\/.*/); //case matters, only beginning of string
  is.object(data, ref);

  return db.put(ref, JSON.stringify(data))
    .return(data);
}

/**
 * Consistent way to get uri data.  Validation of URI can go here.
 * @param {string} ref
 * @returns {Promise.string}
 */
function getUriData(ref) {
  is(ref, 'uri reference');
  is.string.match(ref, /^\/uris\/.*/); //case matters, only beginning of string

  return db.get(ref);
}

/**
 * Consistent way to put uri data.  Validation of URI can go here.
 * @param {string} ref
 * @param {string} data
 * @returns {Promise.string}
 */
function putUriData(ref, data) {
  is(ref, 'uri reference');
  is.string.match(ref, /^\/uris\/.*/); //case matters, only beginning of string
  is.string(data, ref);

  return db.put(ref, data).return(data);
}


/**
 *
 * @param {string} ref
 */
function getSchema(ref) {
  return bluebird.try(function () {
    var componentName = getComponentName(ref);

    is(ref, 'reference');
    is(componentName, 'component name', ref);

    return schema.getSchema(files.getComponentPath(componentName));
  });
}

/**
 *
 * @param {string} ref
 * @returns {*}
 */
function getTemplate(ref) {
  is(ref, 'reference');

  // if there are slashes in this name, they've given us a reference like /components/name/instances/id
  if (ref.indexOf('/') !== -1) {
    ref = getComponentName(ref);
    is(ref, 'component name', ref);
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

module.exports.getUriData = getUriData;
module.exports.putUriData = putUriData;
module.exports.getPageData = getPageData;
module.exports.putPageData = putPageData;
module.exports.getComponentName = getComponentName;
module.exports.getComponentData = getComponentData;
module.exports.putComponentData = putComponentData;
module.exports.listComponentData = listComponentData;
module.exports.listComponentInstances = listComponentInstances;
module.exports.getSchema = getSchema;
module.exports.getTemplate = getTemplate;
