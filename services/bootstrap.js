'use strict';
var fs = require('fs'),
  path = require('path'),
  yaml = require('js-yaml'),
  _ = require('lodash'),
  db = require('./db'),
  bluebird = require('bluebird'),
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
 * @param {[]} promises
 */
function saveObject(name, thing, promises) {
  winston.info('saving ' + name + '\n' + chalk.dim(require('util').inspect(thing, true, 5)));
  promises.push(db.put(name, JSON.stringify(thing)));
}

function saveString(name, str, promises) {
  winston.info('saving ' + name + '\n' + chalk.dim(require('util').inspect(str, true, 5)));
  promises.push(db.put(name, str));
}

/**
 * Component specific loading.
 * @param {{}} list
 * @param {[]} promises
 */
function saveComponents(list, promises) {
  var name;

  if (list) {
    _.each(list, function (item, itemName) {

      //load item defaults
      name = '/components/' + itemName;
      saveObject(name, _.omit(item, 'instances'), promises);

      if (item && item.instances) {
        _.each(item.instances, function (instance, instanceId) {

          //load instances
          name = '/components/' + itemName + '/instances/' + instanceId;
          saveObject(name, instance, promises);

        });
      }
    });
  }
}

/**
 * Page specific loading.  This will probably grow differently than component loading, so different function to
 *   contain it.
 * @param {{}} list
 * @param {[]} promises
 */
function savePages(list, promises) {
  var name;

  if (list) {
    _.each(list, function (item, itemName) {

      //load item defaults
      name = '/pages/' + itemName;
      saveObject(name, item, promises);
    });
  }
}

/**
 * Page specific loading.  This will probably grow differently than component loading, so different function to
 *   contain it.
 * @param {{}} list
 * @param {[]} promises
 */
function saveUris(list, promises) {
  var name;

  if (list) {
    _.each(list, function (item, itemName) {

      //load item defaults
      name = '/uris/' + new Buffer(itemName).toString('base64');
      saveString(name, item, promises);
    });
  }
}

function saveLists(list, promises) {
  var name;

  if (list) {
    _.each(list, function (item, itemName) {

      //load item defaults
      name = '/lists/' + itemName;
      saveObject(name, item, promises);
    });
  }
}

/**
 * Load items into db from yaml file
 * @param {string} path
 */
module.exports = function (path) {
  var bootstrap = getConfig(path),
    promises = [];

  saveUris(bootstrap.uris, promises);
  savePages(bootstrap.pages, promises);
  saveComponents(bootstrap.components, promises);
  saveLists(bootstrap.lists, promises);

  return bluebird.all(promises).filter(_.identity);
};
