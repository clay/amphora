'use strict';
var path = require('path'),
  files = require('./files');

/**
 * Get a single schema from a specific directory (maybe including those in node_modules??)
 * @param {string} dir
 * @returns {{}}
 * @throws if missing file or invalid yaml
 */
function getSchema(dir) {
  return files.getYaml(path.join(dir, 'schema'));
}

module.exports.getSchema = getSchema;
