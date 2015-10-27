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
  var file;

  try {
    // try .yaml
    file = fs.readFileSync(path.resolve(dir, 'schema.yaml'), 'utf8');
  } catch (e) {
    // then try .yml
    file = fs.readFileSync(path.resolve(dir, 'schema.yml'), 'utf8');
  }

  return yaml.safeLoad(file);
}

module.exports.getSchema = getSchema;
