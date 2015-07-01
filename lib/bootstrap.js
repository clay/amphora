'use strict';
var fs = require('fs'),
  path = require('path'),
  yaml = require('js-yaml'),
  _ = require('lodash'),
  bluebird = require('bluebird'),
  components = require('./services/components'),
  db = require('./services/db'),
  log = require('./log'),
  chalk = require('chalk');

/**
 * Get yaml file as json
 * @param {string} dir
 * @returns {Object}
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
 * @param {Object} thing
 */
function getPutOperation(name, thing) {
  if (typeof thing === 'object') {
    thing = JSON.stringify(thing);
  }
  return {type: 'put', key: name, value: thing};
}

/**
 * Component specific loading.
 * @param {string} dbPath
 * @param {Object} list
 * @param {function} save
 * @returns Promise
 */
function saveWithInstances(dbPath, list, save) {
  var promises = [];

  //load item defaults
  _.each(list, function (item, itemName) {
    var obj =  _.omit(item, 'instances');

    promises.push(save(dbPath + itemName, obj));

    if (item && item.instances) {
      //load instances
      _.each(item.instances, function (instance, instanceId) {
        promises.push(save(dbPath + itemName + '/instances/' + instanceId, instance));
      });
    }
  });

  return bluebird.all(promises);
}

/**
 * Page specific loading.  This will probably grow differently than component loading, so different function to
 *   contain it.
 * @param {string} dbPath
 * @param {Object} list
 * @param {function} save
 */
function saveBase64Strings(dbPath, list, save) {
  return bluebird.all(_.map(list, function (item, itemName) {
    return save(dbPath + new Buffer(itemName).toString('base64'), item);
  }));
}

/**
 *
 * @param {string} dbPath
 * @param {Object} list
 * @param {function} save
 */
function saveObjects(dbPath, list, save) {
  return bluebird.all(_.map(list, function (item, itemName) {
    return save(dbPath + itemName, item);
  }));
}

function formatBatchOperations(ops) {
  return _.map(ops, function (op) {
    var str,
      value = op.value;
    try {
      value = require('util').inspect(JSON.parse(value), { showHidden: false, depth: 5, colors: true });
      if (value.indexOf('\n') !== -1) {
        value = '\n' + value;
      }
    } catch (x) {
      //do nothing
    } finally {
      str = ' ' + chalk.blue(op.key + ': ') + chalk.dim(value);
    }
    return str;
  }).join('\n');
}

/**
 * Load items into db from yaml file
 * @param {string} path
 * @returns Promise
 */
module.exports = function (path) {
  var componentsOps, pagesOps, urisOps, listsOps,
    bootstrap = getConfig(path);

  listsOps = saveObjects('/lists/', bootstrap.lists, getPutOperation);
  urisOps = saveBase64Strings('/uris/', bootstrap.uris, getPutOperation);
  componentsOps = saveWithInstances('/components/', bootstrap.components, function (name, item) {
    return bluebird.join(
      components.getPutOperations(name, item),
      components.getPutOperations(name + '@published', item)
    );
  });
  pagesOps = saveObjects('/pages/', bootstrap.pages, function (name, item) {
    return [
      getPutOperation(name, item),
      getPutOperation(name + '@published', item)
    ];
  });

  return bluebird.join(componentsOps, pagesOps, urisOps, listsOps).then(function (ops) {
    ops = _.flattenDeep(ops);

    log.info('bootstrapping...\n' + formatBatchOperations(ops));

    return db.batch(ops, { fillCache: false, sync: false });
  });
};
