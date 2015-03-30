'use strict';
var fs = require('fs'),
  path = require('path'),
  yaml = require('js-yaml'),
  _ = require('lodash');

/**
 * get folder names
 * @param  {string} dir enclosing folder
 * @return {[]}     array of folder names
 */
module.exports.getFolders = function (dir) {
  if (fs.existsSync(dir)) {
    return fs.readdirSync(dir)
      .filter(function (file) {
        return fs.statSync(path.join(dir, file)).isDirectory();
      });
  } else {
    return [];
  }
};

/**
 * @param obj
 * @param filter
 *
 * NOTE:  Should probably put this in our lodash utils
 */
function listDeepObjects(obj, filter) {
  var cursor, items,
    list = [],
    queue = [obj];

  while(queue.length) {
    cursor = queue.pop();
    items = _.filter(cursor, _.isObject);
    list = list.concat(_.filter(items, filter || _.identity));
    queue = queue.concat(items);
  }

  return list;
}

/**
 * Get a single schema
 * @param {string} dir
 * @returns {{}}
 */
module.exports.getSchema = function (dir) {
  if (fs.existsSync(dir)) {
    return yaml.safeLoad(fs.readFileSync(path.resolve(dir, 'schema.yaml'), 'utf8'));
  } else {
    return null;
  }
};

/**
 * Get a component schema, and all the schema's within.
 * @param {string} dir
 * @returns {{}}
 */
module.exports.resolveComponentSchema = function (dir) {
  var schema = this.getSchema(dir);

  if (schema) {
    //get all the components in this schema
    var components = listDeepObjects(schema, '_type');

    //now get all the components in those schemas
    console.log(require('util').inspect(components, true, 5));

    return {
      schema: schema,
      components: components
    };

  } else {
    return null;
  }
};