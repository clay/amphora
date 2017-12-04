'use strict';

const path = require('path'),
  files = require('./files'),
  fs = require('fs'),
  log = require('./services/log').setup({ file: __filename });

/**
 * Get a single schema from a specific directory (maybe including those in node_modules??)
 * @param {string} dir
 * @returns {{}}
 * @throws if missing file or invalid yaml
 */
function getSchema(dir) {
  const schema = files.getYaml(path.join(dir, 'schema'));

  if (!schema) {
    let parsedPath = path.parse(dir),
      error = new Error(`Schema not found for component: ${parsedPath.name}!`);

    log('error', error);
    return error;
  }

  return schema;
}

function getSchemaPath(dir) {
  var ymlPath, yamlPath;

  if (!dir || typeof dir !== 'string') {
    throw new Error('Directory path is invalid for dir: ', dir);
  }

  ymlPath = path.join(dir, 'schema.yml');
  yamlPath = path.join(dir, 'schema.yaml');

  if (fs.existsSync(ymlPath)) {
    return ymlPath;
  } else if (fs.existsSync(yamlPath)) {
    return yamlPath;
  } else {
    throw new Error('Schema path not found in ' + dir);
  }
}

module.exports.getSchema = getSchema;
module.exports.getSchemaPath = getSchemaPath;
