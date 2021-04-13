'use strict';

const _ = require('lodash'),
  references = require('./references'),
  bluebird = require('bluebird'),
  control = require('../control'),
  { replaceVersion } = require('clayutils'),
  bus = require('./bus'),
  referenceProperty = '_ref';
var db = require('./db');

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
    // so the op gets the first level of data, but it's removed from the main obj
    clearOwnProperties(obj);
    obj[referenceProperty] = ref;

    return op;
  });

  // add the cleaned root object at the end
  ops.push({key: uri, value: data});

  return ops;
}

/**
 * Adds user info onto each op object
 *
 * @param {Object} locals
 * @param {Object} locals.user
 * @returns {Function}
 */
function addUserInfoToOp(locals) {
  if (!locals) {
    return _.identity;
  }

  const { user } = locals;

  function addUserProp(op) {
    op.user = user;
  }

  return (opsList) => {
    opsList.forEach(addUserProp);
    return opsList;
  };
}

/**
 * Get a list of all the put operations needed to complete a cascading PUT
 *
 * NOTE: this function changes the data object _in-place_ for speed and memory reasons. We are not okay with doing
 * a deep clone here, because that will significantly slow down this operation.  If someone wants to deep clone the data
 * before this operation, they can.
 *
 * @param {Function} putFn
 * @param {String} uri
 * @param {Object} data
 * @param {Object} [locals]
 * @returns {Promise}
 */
function getPutOperations(putFn, uri, data, locals) {
  // potentially propagate version throughout object
  const cmptOrLayout = splitCascadingData(uri, replacePropagatingVersions(uri, data));

  // if locals exist and there are more than one component being put,
  // then we should pass a read-only version to each component so they can't affect each other
  // this operation isn't needed in the common case of putting a single object
  if (!!locals && cmptOrLayout.length > 0) {
    locals = control.setReadOnly(_.cloneDeep(locals));
  }

  // run each through the normal put, which may or may not hit custom component logic
  return bluebird
    .map(cmptOrLayout, ({ key, value }) => putFn(key, value, locals))
    .then(ops => _.filter(_.flattenDeep(ops), _.identity))
    .then(addUserInfoToOp(locals));
}

/**
 * @param {Function} putFn
 * @returns {Function}
 */
function cascadingPut(putFn) {
  return (uri, data, locals) => {
    // split data into pieces
    return module.exports.getPutOperations(putFn, uri, data, locals).then(ops => {
      // PUT operations have to put something, otherwise the operation is not a put -- if they got this far, it is
      // the component's fault, not the client.  If it is a client error, an assertion should have caught this sooner.
      if (!ops.length) {
        throw new Error(`Component module PUT failed to create batch operations: ${uri}`);
      }

      // return ops if successful
      return db.batch(ops)
        .then(() => bus.publish('save', ops))
        .then(() => {
          // return the value of the last batch operation (the root object) if successful
          const rootOp = _.last(ops);

          return rootOp && JSON.parse(rootOp.value);
        });
    });
  };
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

module.exports.cascadingPut = cascadingPut;
module.exports.getPutOperations = getPutOperations;
module.exports.putDefaultBehavior = putDefaultBehavior;

// For testing
module.exports.setDb = mock => db = mock;
