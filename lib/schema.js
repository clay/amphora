'use strict';
var fs = require('fs'),
  path = require('path'),
  yaml = require('js-yaml'),
  _ = require('lodash');

_.mixin(require('lodash-ny-util'));

/**
 * Get a single schema from a specific directory (maybe including those in node_modules??)
 * @param {string} dir
 * @returns {{}}
 * @throws if missing file or invalid yaml
 */
function getSchema(dir) {
  return yaml.safeLoad(fs.readFileSync(path.resolve(dir, 'schema.yaml'), 'utf8'));
}

module.exports.getSchema = getSchema;