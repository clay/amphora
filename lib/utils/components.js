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
 * @example /_components/base  returns base
 * @example /_components/text/instances/0  returns text
 * @example /_components/image.html  returns image
 */
function getName(uri) {
  const result = /_components\/(.+?)[\/\.@]/.exec(uri) || /_components\/(.+)/.exec(uri);

  return result && result[1];
}


module.exports.getName = getName;
module.exports.getSchema = getSchema;
