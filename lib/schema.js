'use strict';

const path = require('path'),
  files = require('./files');

/**
 * Get a single schema from a specific directory (maybe including those in node_modules??)
 * @param {string} dir
 * @returns {{}}
 * @throws if missing file or invalid yaml
 */
function getSchema(dir) {
  const schema = files.getYaml(path.join(dir, 'schema'));

  if (!schema) {
    throw new Error('Schema not found!');
  }

  return schema;
}

module.exports.getSchema = getSchema;
