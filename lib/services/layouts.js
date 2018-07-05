'use strict';

const _ = require('lodash'),
  composer = require('./composer'),
  dbOps = require('./db-operations'),
  uid = require('../uid'),
  files = require('../files'),
  models = require('./models'),
  { getLayoutName, replaceVersion } = require('clayutils'),
  bus = require('./bus'),
  referenceProperty = '_ref';

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
    model = name && files.getLayoutModule(name),
    callHooks = _.get(locals, 'hooks') !== 'false',
    reqExtension = _.get(locals, 'extension'),
    renderModel = reqExtension && files.getLayoutModule(name, reqExtension),
    executeRender = model && _.isFunction(model.render) && callHooks;

  return models.get(model, renderModel, executeRender, uri, locals);
}

/**
 * PUT to just :id or @latest writes to both locations and creates a new version.
 * @param {string} uri   Assumes no @version
 * @param {object} data
 * @returns {Array}
 */
function putLatest(uri, data) {
  data = JSON.stringify(data);
  return [
    { type: 'put', key: replaceVersion(uri), value: data }
  ];
}

/**
 *
 * @param {string} uri   Assumes no @version
 * @param {object} data
 * @returns {Array}
 */
function putPublished(uri, data) {
  data = JSON.stringify(data);
  return [
    { type: 'put', key: replaceVersion(uri, 'published'), value: data }
  ];
}

/**
 *
 * @param {string} uri  Assumes no @version
 * @param {object} data
 * @param {string} tag  unique tag
 * @returns {Array}
 */
function putTag(uri, data, tag) {
  data = JSON.stringify(data);
  return [
    { type: 'put', key: replaceVersion(uri, tag), value: data }
  ];
}

/**
 *
 * @param {string} uri
 * @param {object} data
 * @returns {Array}
 */
function putDefaultBehavior(uri, data) {
  const split = uri.split('@'),
    path = split[0],
    version = split[1];

  if (version) {
    if (version === 'published') {
      return putPublished(path, data);
    } else {
      return putTag(path, data, version);
    }
  } else {
    return putLatest(path, data);
  }
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
  var model = files.getLayoutModule(getLayoutName(uri)),
    callHooks = _.get(locals, 'hooks') !== 'false',
    result;

  if (module && _.isFunction(model.save) && callHooks) {
    result = models.put(model, uri, data, locals);
  } else {
    result = putDefaultBehavior(uri, data);
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

  // TODO: PUT IN THE BUS EVENT
  // let obj = { uri: uri, data: publishedData, user: locals && locals.user };
  // bus.publish('publishLayout', JSON.stringify(obj));

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

// data rearrangement
module.exports.getPutOperations = getPutOperations;

// For testing
module.exports.setLog = mock => log = mock;
module.exports.setDb = mock => db = mock;
