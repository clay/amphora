'use strict';
var fs = require('fs'),
  path = require('path'),
  yaml = require('js-yaml'),
  _ = require('lodash'),
  db = require('./services/db'),
  winston = require('winston'),
  chalk = require('chalk');

/**
 * Get yaml file as json
 * @param {string} dir
 * @returns {{}}
 */
function getConfig(dir) {
  return yaml.safeLoad(fs.readFileSync(path.resolve(dir), 'utf8'));
}

/**
 * Save an thing (any thing) to the database, and log that we did so.
 *
 * If we don't like this logging, we could add levels to winston, or add dev or debug levels to the config.
 *
 * For the current stage, it's most useful as info.
 *
 * @param {string} name
 * @param {{}} thing
 * @param {[]} ops
 */
function saveObject(name, thing, ops) {
  winston.info('saving ' + name + '\n' + chalk.dim(require('util').inspect(thing, true, 5)));
  ops.push({type: 'put', key: name, value: JSON.stringify(thing)});
}

function saveString(name, str, ops) {
  winston.info('saving ' + name + '\n' + chalk.dim(require('util').inspect(str, true, 5)));
  ops.push({type: 'put', key: name, value: str});
}

/**
 * Component specific loading.
 * @param {{}} list
 * @param {[]} ops
 */
function saveComponents(list, ops) {
  var name;

  if (list) {
    _.each(list, function (item, itemName) {

      //load item defaults
      name = '/components/' + itemName;
      saveObject(name, _.omit(item, 'instances'), ops);
      saveObject(name + '@latest', _.omit(item, 'instances'), ops);

      if (item && item.instances) {
        _.each(item.instances, function (instance, instanceId) {

          //load instances
          name = '/components/' + itemName + '/instances/' + instanceId;
          saveObject(name, instance, ops);
          saveObject(name + '@latest', instance, ops);

        });
      }
    });
  }
}

/**
 * Page specific loading.  This will probably grow differently than component loading, so different function to
 *   contain it.
 * @param {string} dbPath
 * @param {{}} list
 * @param {[]} ops
 */
function saveBase64Strings(dbPath, list, ops) {
  var name;

  if (list) {
    _.each(list, function (item, itemName) {
      name = dbPath + new Buffer(itemName).toString('base64');
      saveString(name, item, ops);
    });
  }
}

/**
 *
 * @param {string} dbPath
 * @param {{}} list
 * @param {[]} ops
 */
function saveObjects(dbPath, list, ops) {
  var name;

  if (list) {
    _.each(list, function (item, itemName) {
      name = dbPath + itemName;
      saveObject(name, item, ops);
    });
  }
}

/**
 * Load items into db from yaml file
 * @param {string} path
 */
module.exports = function (path) {
  var bootstrap = getConfig(path),
    ops = [];

  saveComponents(bootstrap.components, ops);
  saveBase64Strings('/uris/', bootstrap.uris, ops);
  saveObjects('/pages/', bootstrap.pages, ops);
  saveObjects('/lists/', bootstrap.lists, ops);

  return db.batch(ops, { fillCache: false, sync: false });
};
