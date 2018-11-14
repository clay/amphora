'use strict';

const _ = require('lodash'),
  composer = require('./composer'),
  db = require('./db'),
  uid = require('../uid'),
  files = require('../files'),
  schema = require('../schema'),
  bluebird = require('bluebird'),
  models = require('./models'),
  dbOps = require('./db-operations'),
  { getComponentName, replaceVersion } = require('clayutils'),
  plugins = require('../plugins'),
  bus = require('./bus'),
  referenceProperty = '_ref';

/**
 * @param {string} uri
 * @param {object} [locals]
 * @returns {Promise}
 */
function get(uri, locals) {
  const name = getComponentName(uri),
    reqExtension = _.get(locals, 'extension'),
    model = name && files.getComponentModule(name),
    callComponentHooks = _.get(locals, 'componenthooks') !== 'false',
    executeRender = model && _.isFunction(model.render) && callComponentHooks,
    renderModel = reqExtension && files.getComponentModule(name, reqExtension);

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
    callHooks = _.get(locals, 'componenthooks') !== 'false',
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
 * determine if a component is a layout, by checking its schema
 * @param  {string}  uri
 * @return {Promise}
 */
function isLayout(uri) {
  return getSchema(uri).then((schema) => {
    return _.get(schema, '_layout', false);
  }).catch(() => false);
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
    return dbOps.cascadingPut(put)(uri, data, locals)
      .then(publishedData => isLayout(uri).then((definitelyALayout) => {
        if (definitelyALayout) {
          let obj = { uri: uri, data: publishedData, user: locals && locals.user };

          plugins.executeHook('publishLayout', obj);
          bus.publish('publishLayout', JSON.stringify(obj));
        }
        return publishedData;
      }));
  }

  return get(replaceVersion(uri), locals)
    .then(latestData => composer.resolveComponentReferences(latestData, locals, filterBaseInstanceReferences))
    .then(versionedData => dbOps.cascadingPut(put)(uri, versionedData, locals))
    .then(publishedData => isLayout(uri).then((definitelyALayout) => {
      if (definitelyALayout) {
        let obj = { uri: uri, data: publishedData, user: locals && locals.user };

        plugins.executeHook('publishLayout', obj);
        bus.publish('publishLayout', JSON.stringify(obj));
      }
      return publishedData;
    }));
}

/**
 * Delete component data.
 *
 * Gets old values, so we can return them when the thing is deleted
 *
 * @param {string} uri
 * @param {object} [locals]
 * @returns {Promise}
 */
function del(uri, locals) {
  return get(uri).then(oldData => {
    let promise,
      componentModule = files.getComponentModule(getComponentName(uri));

    if (componentModule && _.isFunction(componentModule.del)) {
      promise = componentModule.del(uri, locals);
    } else {
      promise = db.del(uri).return(uri);
    }

    return promise.return(oldData);
  });
}

/**
 * @param {string} uri
 * @param {object} data
 * @param {object} [locals]
 * @returns {Promise}
 */
function post(uri, data, locals) {
  uri += '/' + uid.get();
  return dbOps.cascadingPut(put)(uri, data, locals).then(function (result) {
    result._ref = uri;
    return result;
  });
}

/**
 * @param {string} uri
 * @returns {Promise}
 */
function getSchema(uri) {
  return bluebird.try(function () {
    return schema.getSchema(files.getComponentPath(getComponentName(uri)));
  });
}

// outsiders can act on components too
module.exports.get = get;
module.exports.put = dbOps.cascadingPut(put); // special: could lead to multiple put operations
module.exports.publish = publish;
module.exports.del = del;
module.exports.post = post;
module.exports.cmptPut = put;

// repeatable look-ups
module.exports.getSchema = _.memoize(getSchema);
