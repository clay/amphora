'use strict';

const path = require('path'),
  files = require('./files'),
  _ = require('lodash'),
  bluebird = require('bluebird'),
  buf = require('./services/buffer'),
  components = require('./services/components'),
  dbOps = require('./services/db-operations'),
  siteService = require('./services/sites'),
  references = require('./services/references'),
  highland = require('highland'),
  { encode } = require('./services/buffer'),
  locals = require('./locals');
var log = require('./services/logger').setup({
    file: __filename,
    action: 'bootstrap'
  }),
  db = require('./services/db'),
  ERRORING_COMPONENTS = [
    'clay-kiln' // initialize with Kiln so we don't get an unecessary error message
  ];

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
 * @param {string} name
 * @param {object} thing
 * @returns {object}
 */
function getPutOperation(name, thing) {
  if (typeof thing === 'object') {
    thing = JSON.stringify(thing);
  }

  return { type: 'put', key: name, value: thing };
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
    return save(dbPath + buf.encode(itemName), item);
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
  bootstrap._pages = _.transform(bootstrap._pages, function (obj, value, key) {
    const list = references.listDeepObjects(value);

    list.push(value);

    _.each(list, function (item) {
      _.each(item, function (value, fieldName, obj) {
        if (_.isString(value) && value[0] === '/') {
          obj[fieldName] = site.prefix + value;

          if (fieldName === 'url') {
            obj[fieldName] = references.uriToUrl(obj[fieldName], site.protocol, site.port);
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
  bootstrap._components = _.transform(bootstrap._components, function (obj, value, key) {
    _.each(references.listDeepObjects(value, '_ref'), function (refObj) {
      if (refObj._ref[0] === '/') {
        refObj._ref = `${site.prefix}${refObj._ref}`;
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
  bootstrap._uris = _.transform(bootstrap._uris, function (obj, value, key) {
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
 * Apply a prefix to all items in the bootstrap file that start with '/'.
 * Clone the data first to make sure we're not abusing mutable objects,
 * otherwise we get incorrect prefixes for components on their sites.
 *
 * @param {object} data
 * @param {object} site
 * @returns {object}
 */
function applyPrefix(data, site) {
  var bootstrap = _.cloneDeep(data);

  applyPrefixToUris(bootstrap, site);
  applyPrefixToPages(bootstrap, site);
  applyPrefixToComponents(bootstrap, site);

  return bootstrap;
}

/**
 * Load items into db from config object
 * @param {object} data
 * @param {object} site
 * @returns {Promise}
 */
function load(data, site) {
  let promiseComponentsOps, promisePagesOps, promiseUrisOps, promiseListsOps, promiseUsersOps,
    prefix = site.prefix,
    compData = applyPrefix(data, site);

  promiseListsOps = saveObjects(`${prefix}/_lists/`, compData._lists, getPutOperation);
  promiseUrisOps = saveBase64Strings(`${prefix}/_uris/`, compData._uris, getPutOperation);
  _.each(compData._uris, function (page, uri) {
    log('info', `bootstrapped: ${uri} => ${page}`);
  });
  promiseComponentsOps = saveWithInstances(`${prefix}/_components/`, compData._components, function (name, item) {
    return bluebird.join(
      dbOps.getPutOperations(components.cmptPut, name, _.cloneDeep(item), locals.getDefaultLocals(site))
    ).then(_.flatten);
  });
  promisePagesOps = saveObjects(`${prefix}/_pages/`, compData._pages, (name, item) => [getPutOperation(name, item)]);
  promiseUsersOps = saveObjects('', compData._users, (name, item) => [getPutOperation(`/_users/${encode(`${item.username}@${item.provider}`)}`, item)]);

  /* eslint max-params: ["error", 5] */
  return bluebird.join(promiseComponentsOps, promisePagesOps, promiseUrisOps, promiseListsOps, promiseUsersOps, function (componentsOps, pagesOps, urisOps, listsOps, userOps) {
    const flatComponentsOps = _.flatten(componentsOps),
      ops = flatComponentsOps.concat(_.flattenDeep(pagesOps.concat(urisOps, listsOps, userOps)));

    return db.batch(ops, { fillCache: false, sync: false });
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
    promise = Promise.reject(new Error(`No bootstrap found at ${dir}`));
  }

  return promise;
}

/**
 * @param {string} site
 * @returns {Promise}
 */
function bootstrapComponents(site) {
  return bluebird.all(_.map(files.getComponents(), function (component) {
    const componentPath = files.getComponentPath(component);

    return module.exports.bootstrapPath(componentPath, site).catch(bootstrapError.bind(null, component));
  }));
}

/**
 * Log a bootstrapping error for if one exists
 * for a component.
 *
 * @param  {String} component
 * @param  {Error} e
 * @return {Promise}
 */
function bootstrapError(component, e) {
  if (ERRORING_COMPONENTS.indexOf(component) === -1) {
    ERRORING_COMPONENTS.push(component);
    log('error', `Error bootstrapping component ${component}: ${e.message}`);
  }

  return bluebird.reject();
}

/**
 * Bootstrap all sites and the individual
 * bootstrap files in each component's directory
 *
 * @return {Promise}
 */
function bootrapSitesAndComponents() {
  const sites = siteService.sites(),
    sitesArray = _.map(Object.keys(sites), site => sites[site]);

  return highland(sitesArray)
    .flatMap(site => {
      return highland(
        bootstrapComponents(site)
          .then(function () {
            return site;
          })
          .catch(function () {
            log('debug', `Errors bootstrapping components for site: ${site.slug}`);
            return site;
          })
      );
    })
    .flatMap(site => {
      return highland(
        bootstrapPath(site.dir, site)
          .catch(function () {
            log('debug', `No bootstrap file found for site: ${site.slug}`);
            return site;
          })
      );
    })
    .collect()
    .toPromise(bluebird);
}

/**
 * Log the skip of bootstrapping and resolve
 * the bootstrap Promise.
 *
 * @return {Promise}
 */
function skipBootstrap() {
  log('info', 'Skipping bootstrapping sites and components');
  return bluebird.resolve();
}

/**
 * Bootstraps components or skip it.
 * @param {boolean} [runBootstrap=true]
 * @return {Promise}
 */
module.exports = (runBootstrap = true) => runBootstrap ? bootrapSitesAndComponents() : skipBootstrap();
module.exports.bootstrapPath = bootstrapPath;

// For testing
module.exports.setLog = mock => log = mock;
module.exports.setDb = mock => db = mock;
