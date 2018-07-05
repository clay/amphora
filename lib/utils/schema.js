'use strict';

const bluebird = require('bluebird'),
  files = require('../files'),
  schema = require('../schema'),
  { getComponentName, getLayoutName, isComponent } = require('clayutils');

/**
 * @param {string} uri
 * @returns {Promise}
 */
function getSchema(uri) {
  return bluebird.try(() => {
    var name = isComponent(uri) ? getComponentName(uri) : getLayoutName(uri);

    return schema.getSchema(files.getComponentPath(name));
  });
}

module.exports.getSchema = getSchema;
