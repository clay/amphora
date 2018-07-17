'use strict';

const _ = require('lodash'),
  composer = require('./composer'),
  uid = require('../uid'),
  files = require('../files'),
  models = require('./models'),
  dbOps = require('./db-operations'),
  { getComponentName, replaceVersion } = require('clayutils'),
  bus = require('./bus'),
  referenceProperty = '_ref';
var log = require('./logger').setup({
    file: __filename
  });

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
 * @param {string} uri
 * @param {string} data
 * @param {object} [locals]
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
 * True if object has a _ref and it is an instance
 * @param {object} obj
 * @returns {boolean}
 */
function filterBaseInstanceReferences(obj) {
  return _.isString(obj[referenceProperty]) && obj[referenceProperty].indexOf('/instances/') !== -1;
}

/**
 *
 * @param {string} uri
 * @param {object} data
 * @param {object} [locals]
 * @returns {Promise}
 */
function publish(uri, data, locals) {
  if (data && _.size(data) > 0) {
    return dbOps.cascadingPut(put)(uri, data, locals);
  }

  return get(replaceVersion(uri), locals)
    .then(latestData => composer.resolveComponentReferences(latestData, locals, filterBaseInstanceReferences))
    .then(versionedData => dbOps.cascadingPut(put)(uri, versionedData, locals));
}

/**
 * @param {string} uri
 * @param {object} data
 * @param {object} [locals]
 * @returns {Promise}
 */
function post(uri, data, locals) {
  uri += '/' + uid.get();
  return dbOps.cascadingPut(put)(uri, data, locals).then(result => {
    result._ref = uri;

    return result;
  });
}

// outsiders can act on components too
module.exports.get = get;
module.exports.put = dbOps.cascadingPut(put); // special: could lead to multiple put operations
module.exports.publish = publish;
module.exports.post = post;

// For testing
module.exports.setLog = mock => log = mock;
