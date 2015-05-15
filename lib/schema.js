'use strict';
var fs = require('fs'),
  path = require('path'),
  yaml = require('js-yaml'),
  _ = require('lodash'),
  db = require('./services/db'),
  bluebird = require('bluebird');

_.mixin(require('lodash-ny-util'));

/**
 * Get a single schema from a specific directory (maybe including those in node_modules??)
 * @param {string} dir
 * @returns {{}}
 */
function getSchema(dir) {
  return yaml.safeLoad(fs.readFileSync(path.resolve(dir, 'schema.yaml'), 'utf8'));
}

module.exports.getSchema = getSchema;