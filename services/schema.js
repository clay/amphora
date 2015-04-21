'use strict';
var fs = require('fs'),
  path = require('path'),
  yaml = require('js-yaml'),
  _ = require('lodash'),
  db = require('./db'),
  bluebird = require('bluebird');

_.mixin(require('lodash-ny-util'));

/**
 * Takes a url path, and returns the component name within it.
 * @param {string} path
 * @returns {string}
 * @example /components/base  returns base
 * @example /components/text/instances/0  returns text
 * @example /components/image.html  returns image
 */
function getComponentNameFromPath(path) {
  var result = /components\/(.+?)[\/\.]/.exec(path) || /components\/(.+)/.exec(path);

  return result && result[1];
}

/**
 * Duck-typing.
 *
 * If the object has `.then`, we assume its a promise
 * @param {*} obj
 * @returns {boolean}
 */
function isPromise(obj) {
  return _.isObject(obj) && _.isFunction(obj.then);
}

/**
 * Duck-typing.
 *
 * If the object has `._type` as a string, we assume its a component
 */
function isComponent(obj) {
  return _.isString(obj._type);
}

/**
 * Get a single schema from a specific directory (maybe including those in node_modules??)
 * @param {string} dir
 * @returns {{}}
 */
function getSchema(dir) {
  return yaml.safeLoad(fs.readFileSync(path.resolve(dir, 'schema.yaml'), 'utf8'));
}

/**
 * Get a component schema, and all the schema's within.
 * @param {string} dir
 * @returns {{}}
 */
function getSchemaComponents(dir) {
  var schema = getSchema(dir);

  if (schema) {
    return _.listDeepObjects(schema, isComponent);
  } else {
    return null;
  }
}

/**
 * Find all _ref, and recursively expand them.
 */
function resolveDataReferences(data) {
  var referenceProperty = '_ref',
    placeholders = _.listDeepObjects(data, referenceProperty);

  return bluebird.all(placeholders).each(function (placeholder) {
    return db.get(placeholder[referenceProperty]).then(JSON.parse).then(function (obj) {
      //the thing we got back might have its own references
      return resolveDataReferences(obj).finally(function () {
        _.assign(placeholder, _.omit(obj, referenceProperty));
      });
    });
  }).return(data);
}

module.exports.isPromise = isPromise;
module.exports.isComponent = isComponent;
module.exports.getComponentNameFromPath = getComponentNameFromPath;
module.exports.getSchema = getSchema;
module.exports.getSchemaComponents = getSchemaComponents;
module.exports.resolveDataReferences = resolveDataReferences;