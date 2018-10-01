'use strict';

const _ = require('lodash'),
  composer = require('./composer'),
  dbOps = require('./db-operations'),
  uid = require('../uid'),
  files = require('../files'),
  models = require('./models'),
  meta = require('./metadata'),
  { getLayoutName, replaceVersion } = require('clayutils'),
  bus = require('./bus');

/**
 * Get layout data from the db and pass it
 * through any model/renderer model/upgrade
 *
 * @param {string} uri
 * @param {object} [locals]
 * @returns {Promise}
 */
function get(uri, locals) {
  const name = getLayoutName(uri),
    model = name && files.getLayoutModules(name),
    callHooks = _.get(locals, 'hooks') !== 'false',
    reqExtension = _.get(locals, 'extension'),
    renderModel = reqExtension && files.getLayoutModules(name, reqExtension),
    executeRender = model && _.isFunction(model.render) && callHooks;

  return models.get(model, renderModel, executeRender, uri, locals);
}

/**
 * Run the data of a component or layout through its
 * model (or not) when being saved
 *
 * @param {string} uri
 * @param {string} data
 * @param {object} [locals]
 * @returns {Promise}
 */
function put(uri, data, locals) {
  var model = files.getLayoutModules(getLayoutName(uri)),
    callHooks = _.get(locals, 'hooks') !== 'false',
    result;

  if (model && _.isFunction(model.save) && callHooks) {
    result = models.put(model, uri, data, locals);
  } else {
    result = dbOps.putDefaultBehavior(uri, data);
  }

  return result;
}

/**
 *
 * @param {string} uri
 * @param {object} data
 * @param {object} [locals]
 * @returns {Promise}
 */
function publish(uri, data, locals) {
  const user = locals && locals.user;

  if (data && _.size(data) > 0) {
    return dbOps.cascadingPut(put)(uri, data, locals)
      .then(data => meta.publishLayout(uri, user)
        .then(() => {
          bus.publish('publishLayout', { uri, data, user });
          return data;
        }));
  }

  return get(replaceVersion(uri), locals)
    .then(latestData => composer.resolveComponentReferences(latestData, locals, composer.filterBaseInstanceReferences))
    .then(versionedData => dbOps.cascadingPut(put)(uri, versionedData, locals))
    .then(data => meta.publishLayout(uri, user).then(() => {
      bus.publish('publishLayout', { uri, data, user });
      return data;
    }));
}

/**
 * @param {string} uri
 * @param {object} data
 * @param {object} [locals]
 * @returns {Promise}
 */
function post(uri, data, locals) {
  const user = locals && locals.user;

  uri += '/' + uid.get();

  return dbOps.cascadingPut(put)(uri, data, locals)
    .then(result => {
      result._ref = uri;

      return meta.createLayout(uri, user)
        .then(() => {
          bus.publish('createLayout', { uri, data, user });
          return result;
        });
    });
}

// outsiders can act on components too
module.exports.get = get;
module.exports.put = dbOps.cascadingPut(put);
module.exports.publish = publish;
module.exports.post = post;

// For testing
module.exports.testPut = put;
