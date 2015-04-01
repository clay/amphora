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
function saveThing(name, thing, promises) {
  thing._ref = name;
  winston.info('saving ' + name + '\n' + chalk.dim(require('util').inspect(thing, true, 5)));
  promises.push(db.put(name, JSON.stringify(thing)));
}

/**
 *
 * @param {{}} componentList
 * @param {[]} promises
 */
function saveComponents(componentList, promises) {
  var name;

  if (componentList) {
    _.each(componentList, function (component, componentName) {

      //load component defaults
      name = '/components/' + componentName;
      saveThing(name, _.omit(component, 'instances'), promises);

      if (component.instances) {
        _.each(component.instances, function (instance, instanceId) {

          //load instances
          name = '/components/' + componentName + '/instance/' + instanceId;
          saveThing(name, instance, promises);

        });
      }
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

  saveComponents(bootstrap.components, promises);

  return bluebird.all(promises).filter(_.identity);
};
