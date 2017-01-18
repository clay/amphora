'use strict';
const path = require('path'),
  files = require('./files'),
  fs = require('fs');

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

function getSchemaPath(dir) {
  const ymlPath = path.join(dir, 'schema.yml'),
    yamlPath = path.join(dir, 'schema.yaml');

  if (fs.existsSync(ymlPath)) {
    return ymlPath;
  } else if (fs.existsSync(yamlPath)) {
    return yamlPath;
  } else {
    throw new Error('Schema path not found!');
  }
}

module.exports.getSchema = getSchema;
module.exports.getSchemaPath = getSchemaPath;
