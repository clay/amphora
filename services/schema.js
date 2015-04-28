'use strict';
var fs = require('fs'),
  path = require('path'),
  yaml = require('js-yaml'),
  _ = require('lodash'),
  db = require('./db'),
  bluebird = require('bluebird');

_.mixin(require('lodash-ny-util'));

/**
 * Get a single schema from a specific directory (maybe including those in node_modules??)
 * @param {string} dir
 * @returns {{}}
 */
function getSchema(dir) {
  return yaml.safeLoad(fs.readFileSync(path.resolve(dir, 'schema.yaml'), 'utf8'));
}

/**
 * Find all _ref, and recursively expand them.
 *
 * TODO: schema validation here
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

module.exports.getSchema = getSchema;
module.exports.resolveDataReferences = resolveDataReferences;