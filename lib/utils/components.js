'use strict';

const bluebird = require('bluebird'),
  clayUtils = require('clayutils'),
  files = require('../files'),
  schema = require('../schema');

/**
 * @param {string} uri
 * @returns {Promise}
 */
function getSchema(uri) {
  return bluebird.try(function () {
    return schema.getSchema(files.getComponentPath(clayUtils.getComponentName(uri)));
  });
}

module.exports.getSchema = getSchema;
