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
 * @returns {object}
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
 * @param {object} thing
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
 * @param {object} list
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
 * @param {object} list
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
 * @param {object} list
 * @param {function} save
 */
function saveObjects(dbPath, list, save) {
  return bluebird.all(_.map(list, function (item, itemName) {
    return save(dbPath + itemName, item);
  }));
}

function applyPrefixToPages(bootstrap, prefix) {
  bootstrap.pages = _.transform(bootstrap.pages, function (obj, value, key) {
    var list = _.listDeepObjects(value);
    list.push(value);

    _.each(list, function (item) {
      _.each(item, function (value, fieldName, obj) {
        if (_.isString(value) && value[0] === '/') {
          obj[fieldName] = prefix + value;
        }
      });
    });

    obj[key] = value;
  });
}

function applyPrefixToComponents(bootstrap, prefix) {
  bootstrap.components = _.transform(bootstrap.components, function (obj, value, key) {
    _.each(_.listDeepObjects(value, '_ref'), function (refObj) {
      if (refObj._ref[0] === '/') {
        refObj._ref = prefix + refObj._ref;
      }
    });

    obj[key] = value;
  });
}

function applyPrefixToUris(bootstrap, prefix) {
  bootstrap.uris = _.transform(bootstrap.uris, function (obj, value, key) {
    if (value[0] === '/') {
      value = prefix + value;
    }

    if (key[0] === '/') {
      key = prefix + key;
    }

    obj[key] = value;
  });
}

/**
 * Apply a prefix to all items in the bootstrap file that start with '/'
 *
 * @param {object} bootstrap
 * @param {string} prefix
 */
function applyPrefix(bootstrap, prefix) {
  applyPrefixToUris(bootstrap, prefix);
  applyPrefixToPages(bootstrap, prefix);
  applyPrefixToComponents(bootstrap, prefix);
}

/**
 * Load items into db from config object
 * @param {object} bootstrap
 * @param {string} [prefix]
 * @returns {Promise}
 */
function load(bootstrap, prefix) {
  var componentsOps, pagesOps, urisOps, listsOps;

  if (prefix) {
    applyPrefix(bootstrap, prefix);
  }

  listsOps = saveObjects(prefix + '/lists/', bootstrap.lists, getPutOperation);
  urisOps = saveBase64Strings(prefix + '/uris/', bootstrap.uris, getPutOperation);
  componentsOps = saveWithInstances(prefix + '/components/', bootstrap.components, function (name, item) {
    return bluebird.join(
      components.getPutOperations(name, _.cloneDeep(item)),
      components.getPutOperations(name + '@published', _.cloneDeep(item))
    );
  });
  pagesOps = saveObjects(prefix + '/pages/', bootstrap.pages, function (name, item) {
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
 * @param {string} [prefix]
 * @returns Promise
 */
module.exports = function (path, prefix) {
  prefix = prefix || '';
  var promise,
    bootstrap = getConfig(path);

  if (bootstrap) {
    promise = load(bootstrap, prefix);
  } else {
    promise = Promise.reject(new Error('No bootstrap found at ' + path));
  }

  return promise;
};
