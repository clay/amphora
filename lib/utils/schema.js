'use strict';

const bluebird = require('bluebird'),
  files = require('../files'),
  schema = require('../schema'),
  { getComponentName, getLayoutName, isComponent } = require('clayutils');

/**
 * @param {String} uri
 * @returns {Promise}
 */
function getSchema(uri) {
  return bluebird.try(() => {
    const cmpt = isComponent(uri),
      name = cmpt ? getComponentName(uri) : getLayoutName(uri),
      schemaPath = cmpt ? files.getComponentPath(name) : files.getLayoutPath(name);

    return schema.getSchema(schemaPath);
  });
}

module.exports.getSchema = getSchema;
