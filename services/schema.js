'use strict';
var fs = require('fs'),
  path = require('path'),
  yaml = require('js-yaml'),
  _ = require('lodash'),
  db = require('./db'),
  bluebird = require('bluebird');

/**
 *
 *
 * Duck-typing
 */
function isComponent(obj) {
  return _.isString(obj._type);
}

/**
 * @param obj
 * @param filter
 *
 * NOTE:  Should probably put this in our lodash utils
 */
function listDeepObjects(obj, filter) {
  var cursor, items,
    list = [],
    queue = [obj];

  while(queue.length) {
    cursor = queue.pop();
    items = _.filter(cursor, _.isObject);
    list = list.concat(_.filter(items, filter || _.identity));
    queue = queue.concat(items);
  }

  return list;
}

/**
 * Get a single schema
 * @param {string} dir
 * @returns {{}}
 */
function getSchema(dir) {
  if (fs.existsSync(dir)) {
    return yaml.safeLoad(fs.readFileSync(path.resolve(dir, 'schema.yaml'), 'utf8'));
  } else {
    return null;
  }
}

/**
 * Get a component schema, and all the schema's within.
 * @param {string} dir
 * @returns {{}}
 */
function getSchemaComponents(dir) {
  var schema = getSchema(dir);

  if (schema) {
    return listDeepObjects(schema, isComponent);
  } else {
    return null;
  }
}

/**
 *
 * @param {{}} data
 * @param {string} schema
 * @returns {null||[Error]}
 */
function validateData(data, schema) {
  var schema = getSchema(schema);
}

/**
 * Find all _ref, and recursively expand them.
 */
function resolveDataReferences(data) {
  var referenceProperty = '_ref',
    placeholders = listDeepObjects(data, referenceProperty);

  return bluebird.all(placeholders).each(function (placeholder) {
    return db.get(placeholder[referenceProperty]).then(function (obj) {
      //the thing we got back might have its own references
      return resolveDataReferences(obj).finally(function () {
        _.assign(placeholder, _.omit(obj, referenceProperty));
      });
    });
  }).return(data);
}

module.exports.isComponent = isComponent;
module.exports.listDeepObjects = listDeepObjects;
module.exports.getSchema = getSchema;
module.exports.getSchemaComponents = getSchemaComponents;
module.exports.validateData = validateData;
module.exports.resolveDataReferences = resolveDataReferences;