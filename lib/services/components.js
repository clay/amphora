'use strict';

const _ = require('lodash'),
  composer = require('./composer'),
  uid = require('../uid'),
  files = require('../files'),
  models = require('./models'),
  dbOps = require('./db-operations'),
  { getComponentName, replaceVersion } = require('clayutils');

/**
 * @param {string} uri
 * @param {object} [locals]
 * @returns {Promise}
 */
function get(uri, locals) {
  const name = getComponentName(uri),
    model = name && files.getComponentModule(name),
    callComponentHooks = _.get(locals, 'hooks') !== 'false',
    reqExtension = _.get(locals, 'extension'),
    renderModel = reqExtension && files.getComponentModule(name, reqExtension),
    executeRender = model && _.isFunction(model.render) && callComponentHooks;

  return models.get(model, renderModel, executeRender, uri, locals);
}

/**
 * Given a component uri, its data and the locals
 * check if there exists a model.js file for the
 * component.
 *
 * If yes, run the model.js. If not, turn the component
 * data into ops.
 *
 * @param {String} uri
 * @param {String} data
 * @param {Object} [locals]
 * @returns {Promise}
 */
function put(uri, data, locals) {
  let model = files.getComponentModule(getComponentName(uri)),
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
 * @param {String} uri
 * @param {Object} data
 * @param {Object} [locals]
 * @returns {Promise}
 */
function publish(uri, data, locals) {
  if (data && _.size(data) > 0) {
    return dbOps.cascadingPut(put)(uri, data, locals);
  }

  return get(replaceVersion(uri), locals)
    .then(latestData => composer.resolveComponentReferences(latestData, locals, composer.filterBaseInstanceReferences))
    .then(versionedData => dbOps.cascadingPut(put)(uri, versionedData, locals));
}

/**
 * @param {String} uri
 * @param {Object} data
 * @param {Object} [locals]
 * @returns {Promise}
 */
function post(uri, data, locals) {
  uri += '/' + uid.get();
  return dbOps.cascadingPut(put)(uri, data, locals)
    .then(result => {
      result._ref = uri;

      return result;
    });
}

// outsiders can act on components too
module.exports.get = get;
module.exports.put = dbOps.cascadingPut(put); // special: could lead to multiple put operations
module.exports.publish = publish;
module.exports.post = post;
module.exports.cmptPut = put;
