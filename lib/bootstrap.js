'use strict';
var path = require('path'),
  files = require('./files'),
  _ = require('lodash'),
  bluebird = require('bluebird'),
  components = require('./services/components'),
  db = require('./services/db'),
  log = require('./log');

/**
 * Get yaml file as object
 *
 * @param {string} dir
 * @returns {Object}
 */
function getConfig(dir) {
  dir = path.resolve(dir);

  if (dir.indexOf('.', 2) > 0) {
    //remove extension
    dir = dir.substring(0, dir.indexOf('.', 2));
  }

  if (files.isDirectory(dir)) {
    //default to bootstrap.yaml or bootstrap.yml
    dir = path.join(dir, 'bootstrap');
  }

  return files.getYaml(dir);
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

  // load item defaults
  _.each(list, function (item, itemName) {
    var obj =  _.omit(item, 'instances');

    if (_.isObject(item)) {
      obj =  _.omit(item, 'instances');

      if (_.size(obj) > 0) {
        promises.push(save(dbPath + itemName, obj));
      }

      if (item && item.instances) {
        // load instances
        _.each(item.instances, function (instance, instanceId) {
          if (_.size(instance) > 0) {
            promises.push(save(dbPath + itemName + '/instances/' + instanceId, instance));
          }
        });
      }
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

function applyOptions(bootstrap, options) {
  var prefix;

  if (bootstrap.uris && options.uriPrefix) {
    prefix = options.uriPrefix;
    bootstrap.uris = _.transform(bootstrap.uris, function (uris, value, key) {
      uris[prefix + key] = value;
    });
  }
}

/**
 * Load items into db from config object
 * @param {object} bootstrap
 * @param {object} options
 * @returns {Promise.<T>|*}
 */
function load(bootstrap, options) {
  var componentsOps, pagesOps, urisOps, listsOps;

  applyOptions(bootstrap, options);

  listsOps = saveObjects('/lists/', bootstrap.lists, getPutOperation);
  urisOps = saveBase64Strings('/uris/', bootstrap.uris, getPutOperation);
  componentsOps = saveWithInstances('/components/', bootstrap.components, function (name, item) {
    return bluebird.join(
      components.getPutOperations(name, _.cloneDeep(item)),
      components.getPutOperations(name + '@published', _.cloneDeep(item))
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

    log.info('bootstrapping...\n' + db.formatBatchOperations(ops));

    return db.batch(ops, { fillCache: false, sync: false });
  });
}

/**
 * Load items into db from yaml file
 * @param {string} path
 * @param {object} options
 * @returns Promise
 */
module.exports = function (path, options) {
  options = options || {};
  var promise,
    bootstrap = getConfig(path);

  if (bootstrap) {
    promise = load(bootstrap, options);
  } else {
    promise = Promise.reject(new Error('No bootstrap found at ' + path));
  }

  return promise;
};
