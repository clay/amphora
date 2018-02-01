'use strict';

const bluebird = require('bluebird'),
  files = require('../files'),
  schema = require('../schema');

/**
 * @param {string} uri
 * @returns {Promise}
 */
function getSchema(uri) {
  return bluebird.try(function () {
    return schema.getSchema(files.getComponentPath(getName(uri)));
  });
}

module.exports.getSchema = getSchema;
