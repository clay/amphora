'use strict';
const path = require('path'),
  files = require('./files'),
  _ = require('lodash'),
  bluebird = require('bluebird'),
  components = require('./services/components'),
  siteService = require('./services/sites'),
  references = require('./services/references'),
  db = require('./services/db'),
  log = require('./log').withStandardPrefix(__filename),
  chalk = require('chalk');

/**
 * Get yaml file as object
 *
 * @param {string} dir
 * @returns {object}
 */
function getConfig(dir) {
  dir = path.resolve(dir);

  if (dir.indexOf('.', 2) > 0) {
    // remove extension
    dir = dir.substring(0, dir.indexOf('.', 2));
  }

  if (files.isDirectory(dir)) {
    // default to bootstrap.yaml or bootstrap.yml
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
 * @returns {object}
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
 * @returns {Promise}
 */
function saveWithInstances(dbPath, list, save) {
  const promises = [];

  // load item defaults
  _.each(list, function (item, itemName) {
    let obj = _.omit(item, 'instances');

    if (_.isObject(item)) {
      obj = _.omit(item, 'instances');

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
 * @returns {Promise}
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
 * @returns {Promise}
 */
function saveObjects(dbPath, list, save) {
  return bluebird.all(_.map(list, function (item, itemName) {
    return save(dbPath + itemName, item);
  }));
}

/**
 * @param {object} bootstrap
 * @param {object} site
 */
function applyPrefixToPages(bootstrap, site) {
  bootstrap.pages = _.transform(bootstrap.pages, function (obj, value, key) {
    const list = references.listDeepObjects(value);

    list.push(value);

    _.each(list, function (item) {
      _.each(item, function (value, fieldName, obj) {
        if (_.isString(value) && value[0] === '/') {
          obj[fieldName] = site.prefix + value;

          if (fieldName === 'url') {
            obj[fieldName] = references.uriToUrl(obj[fieldName], site.proto, site.port);
          }
        }
      });
    });

    obj[key] = value;
  });
}


/**
 * @param {object} bootstrap
 * @param {object} site
 */
function applyPrefixToComponents(bootstrap, site) {
  bootstrap.components = _.transform(bootstrap.components, function (obj, value, key) {
    _.each(references.listDeepObjects(value, '_ref'), function (refObj) {
      if (refObj._ref[0] === '/') {
        refObj._ref = site.prefix + refObj._ref;
      }
    });

    obj[key] = value;
  });
}

/**
 * @param {object} bootstrap
 * @param {object} site
 */
function applyPrefixToUris(bootstrap, site) {
  bootstrap.uris = _.transform(bootstrap.uris, function (obj, value, key) {
    if (value[0] === '/') {
      value = site.prefix + value;
    }

    if (key[0] === '/') {
      key = site.prefix + key;
    }

    obj[key] = value;
  });
}

/**
 * Apply a prefix to all items in the bootstrap file that start with '/'
 *
 * @param {object} bootstrap
 * @param {object} site
 */
function applyPrefix(bootstrap, site) {
  applyPrefixToUris(bootstrap, site);
  applyPrefixToPages(bootstrap, site);
  applyPrefixToComponents(bootstrap, site);
}

/**
 * Load items into db from config object
 * @param {object} data
 * @param {object} site
 * @returns {Promise}
 */
function load(data, site) {
  let promiseComponentsOps, promisePagesOps, promiseUrisOps, promiseListsOps,
    prefix = site.prefix;

  applyPrefix(data, site);

  promiseListsOps = saveObjects(prefix + '/lists/', data.lists, getPutOperation);
  promiseUrisOps = saveBase64Strings(prefix + '/uris/', data.uris, getPutOperation);
  _.each(data.uris, function (page, uri) {
    log('info', 'bootstrapped: ' + chalk.blue(uri) + chalk.dim(' => ') + chalk.dim(page));
  });
  promiseComponentsOps = saveWithInstances(prefix + '/components/', data.components, function (name, item) {
    return bluebird.join(
      components.getPutOperations(name, _.cloneDeep(item))
    ).then(_.flatten);
  });
  promisePagesOps = saveObjects(prefix + '/pages/', data.pages, function (name, item) {
    return [
      getPutOperation(name, item)
    ];
  });

  return bluebird.join(promiseComponentsOps, promisePagesOps, promiseUrisOps, promiseListsOps, function (componentsOps, pagesOps, urisOps, listsOps) {
    const flatComponentsOps = _.flatten(componentsOps),
      ops = flatComponentsOps.concat(_.flattenDeep(pagesOps.concat(urisOps, listsOps)));

    return db.batch(ops, {fillCache: false, sync: false});
  });
}

/**
 * Load items into db from yaml file
 * @param {string} dir
 * @param {object} site
 * @returns {Promise}
 */
function bootstrapPath(dir, site) {
  let promise,
    data = getConfig(dir);

  if (data) {
    promise = load(data, site);
  } else {
    promise = Promise.reject(new Error('No bootstrap found at ' + dir));
  }

  return promise;
}

/**
 * @param {string} site
 * @returns {Promise}
 */
function bootstrapComponents(site) {
  const components = files.getComponents();

  return bluebird.all(_.map(components, function (component) {
    const componentPath = files.getComponentPath(component);

    return bootstrapPath(componentPath, site).catch(function () {});
  }));
}

module.exports = function () {
  const sites = siteService.sites();

  return bluebird.all(_.map(sites, function (site) {
    return bootstrapComponents(site).then(function () {
      return bootstrapPath(site.dir, site).catch(function (ex) {
        log('verbose', 'bootstrap error:', ex);
      });
    });
  }));
};

module.exports.bootstrapPath = bootstrapPath;
