'use strict';

const _ = require('lodash'),
  control = require('../control'),
  composer = require('./composer'),
  uid = require('../uid'),
  files = require('../files'),
  references = require('./references'),
  models = require('./models'),
  bluebird = require('bluebird'),
  { getComponentName, replaceVersion } = require('clayutils'),
  referenceProperty = '_ref';
var db = require('./db'),
  log = require('./logger').setup({
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
    result = putDefaultBehavior(uri, data);
  }

  return result;
}

/**
 * Clear all of an object properties (in place), not a new object.
 *
 * @param {object} obj
 * @returns {object}
 */
function clearOwnProperties(obj) {
  _.forOwn(obj, function (value, key) {
    delete obj[key];
  });

  return obj;
}

/**
 * True if this is a reference object that also has real data in it.
 *
 * Used to determine if that data should be preserved or not.
 *
 * @param {object} obj
 * @returns {boolean}
 */
function isReferencedAndReal(obj) {
  return _.isString(obj[referenceProperty]) && _.size(obj) > 1;
}

/**
 * If the ref has a version that is "propagating" like @published or @latest, replace all versions in the data
 *  with the new version (in-place).
 * @param {string} uri
 * @param {object} data
 * @returns {object}
 */
function replacePropagatingVersions(uri, data) {
  if (references.isPropagatingVersion(uri)) {
    references.replaceAllVersions(uri.split('@')[1])(data);
  }

  return data;
}

/**
 * Split cascading component data into individual components
 * @param {string} uri  Root reference in uri form
 * @param {object} data  Cascading component data
 * @returns {[{key: string, value: object}]}
 */
function splitCascadingData(uri, data) {
  let ops, list;

  // search for _ref with _size greater than 1
  list = references.listDeepObjects(data, isReferencedAndReal);
  ops = _.map(list.reverse(), function (obj) {
    const ref = obj[referenceProperty],
      // since children are before parents, no one will see data below them
      op = {key: ref, value: _.omit(obj, referenceProperty)};

    // omit cloned 1 level deep and we clear what omit cloned from obj
    //  so the op gets the first level of data, but it's removed from the main obj
    clearOwnProperties(obj);
    obj[referenceProperty] = ref;

    return op;
  });

  // add the cleaned root object at the end
  ops.push({key: uri, value: data});

  return ops;
}

/**
 * Get a list of all the put operations needed to complete a cascading PUT
 *
 * NOTE: this function changes the data object _in-place_ for speed and memory reasons. We are not okay with doing
 * a deep clone here, because that will significantly slow down this operation.  If someone wants to deep clone the data
 * before this operation, they can.
 *
 * @param {string} uri
 * @param {object} data
 * @param {object} [locals]
 * @returns {Promise}
 */
function getPutOperations(uri, data, locals) {
  // potentially propagate version throughout object
  const components = splitCascadingData(uri, replacePropagatingVersions(uri, data));

  // if locals exist and there are more than one component being put,
  // then we should pass a read-only version to each component so they can't affect each other
  // this operation isn't needed in the common case of putting a single object
  if (!!locals && components.length > 0) {
    locals = control.setReadOnly(_.cloneDeep(locals));
  }

  // run each through the normal put, which may or may not hit custom component logic
  return bluebird.map(components, op => put(op.key, op.value, locals))
    .then(ops => _.filter(_.flattenDeep(ops), _.identity));
}

/**
 * @param {string} uri
 * @param {object} data
 * @param {object} [locals]
 * @returns {Promise}
 */
function cascadingPut(uri, data, locals) {
  // split data into pieces
  return module.exports.getPutOperations(uri, data, locals).then(function (ops) {
    // PUT operations have to put something, otherwise the operation is not a put -- if they got this far, it is
    // the component's fault, not the client.  If it is a client error, an assertion should have caught this sooner.
    if (!ops.length) {
      throw new Error('Component module PUT failed to create batch operations: ' + uri);
    }

    // return ops if successful
    return db.batch(ops).then(() => {
      // return the value of the last batch operation (the root object) if successful
      const rootOp = _.last(ops);

      return rootOp && JSON.parse(rootOp.value);
    });
  });
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
    return cascadingPut(uri, data, locals);
  }

  return get(replaceVersion(uri), locals)
    .then(latestData => composer.resolveComponentReferences(latestData, locals, filterBaseInstanceReferences))
    .then(versionedData => cascadingPut(uri, versionedData, locals));
}

/**
 * @param {string} uri
 * @param {object} data
 * @param {object} [locals]
 * @returns {Promise}
 */
function post(uri, data, locals) {
  uri += '/' + uid.get();
  return cascadingPut(uri, data, locals).then(function (result) {
    result._ref = uri;
    return result;
  });
}

// outsiders can act on components too
module.exports.get = get;
module.exports.put = cascadingPut; // special: could lead to multiple put operations
module.exports.publish = publish;
module.exports.post = post;

// data rearrangement
module.exports.getPutOperations = getPutOperations;

// For testing
module.exports.setLog = mock => log = mock;
module.exports.setDb = mock => db = mock;
