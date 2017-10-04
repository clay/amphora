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

/**
 * Takes a ref, and returns the component name within it.
 * @param {string} uri
 * @returns {string}
 * @example /components/base  returns base
 * @example /components/text/instances/0  returns text
 * @example /components/image.html  returns image
 */
function getName(uri) {
  const result = /components\/(.+?)[\/\.@]/.exec(uri) || /components\/(.+)/.exec(uri);

  return result && result[1];
}


module.exports.getName = getName;
module.exports.getSchema = getSchema;
