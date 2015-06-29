/**
 * Controller for Components
 *
 * @module
 */

'use strict';

var _ = require('lodash'),
  db = require('./db'),
  uid = require('../uid'),
  files = require('../files'),
  schema = require('../schema'),
  references = require('./references'),
  bluebird = require('bluebird'),
  path = require('path'),
  config = require('config'),
  glob = require('glob'),
  referenceProperty = '_ref';

/**
 * Takes a ref, and returns the component name within it.
 * @param {string} ref
 * @returns {string}
 * @example /components/base  returns base
 * @example /components/text/instances/0  returns text
 * @example /components/image.html  returns image
 */
function getName(ref) {
  var result = /components\/(.+?)[\/\.@]/.exec(ref) || /components\/(.+)/.exec(ref);

  return result && result[1];
}

/**
 * @param {string} ref
 * @param {object} locals
 * @returns {Promise}
 */
function get(ref, locals) {
  var promise,
    componentModule = files.getComponentModule(getName(ref));

  if (_.isFunction(componentModule)) {
    promise = componentModule(ref, locals);
  } else {
    promise = db.get(ref).then(JSON.parse);
  }

  return promise;
}

/**
 * PUT to just :id or @latest writes to both locations and creates a new version.
 * @param {string} ref   Assumes no @version
 * @param {object} data
 * @returns {Promise}
 */
function putLatest(ref, data) {
  data = JSON.stringify(data);
  return [
    { type: 'put', key: ref, value: data },
    { type: 'put', key: ref + '@latest', value: data },
    { type: 'put', key: ref + '@' + uid(), value: data}
  ];
}

/**
 *
 * @param {string} ref   Assumes no @version
 * @param {object} data
 * @returns {Promise}
 */
function putPublished(ref, data) {
  data = JSON.stringify(data);
  return [
    { type: 'put', key: ref + '@published', value: data },
    { type: 'put', key: ref + '@' + uid(), value: data}
  ];
}

/**
 *
 * @param {string} ref  Assumes no @version
 * @param {object} data
 * @param {string} tag  unique tag
 * @returns {Promise}
 */
function putTag(ref, data, tag) {
  data = JSON.stringify(data);
  return [
    { type: 'put', key: ref + '@' + tag, value: data }
  ];
}

/**
 *
 * @param {string} ref
 * @param {object} data
 * @returns {Promise}
 */
function putDefaultBehavior(ref, data) {
  let split = ref.split('@'),
    putPath = split[0],
    version = split[1];

  if (version) {
    switch (version) {
      case 'list':
        throw new Error('Cannot PUT to @list.');
      case 'latest':
        return putLatest(putPath, data);
      case 'published':
        return putPublished(putPath, data);
      default:
        return putTag(putPath, data, version);
    }
  } else {
    return putLatest(putPath, data);
  }
}

/**
 * @param {string} ref
 * @param {object} data
 * @returns {Promise}
 */
function put(ref, data) {
  var result,
    componentModule = files.getComponentModule(getName(ref));

  if (componentModule && _.isFunction(componentModule.put)) {
    result = componentModule.put(ref, data);
  } else {
    result = putDefaultBehavior(ref, data);
  }

  return result;
}

/**
 * Clear all of an object properties (in place), not a new object
 *
 * No need to return anything since it's in-place
 *
 * @param {object} obj
 */
function clearOwnProperties(obj) {
  _.forOwn(obj, function (value, key) {
    delete obj[key];
  });
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
 *  with the new version.
 * @param {string} ref
 * @param {object} data
 */
function replacePropagatingVersions(ref, data) {
  var version = ref.split('@')[1];

  if (references.isPropagatingVersion(ref)) {
    references.replaceAllVersions(version)(data);
  }
}

function splitCascadingData(ref, data) {
  var ops, list;

  // search for _ref with _size greater than 1
  list = _.listDeepObjects(data, isReferencedAndReal);
  ops = _.map(list.reverse(), function (obj) {
    var currRef = obj[referenceProperty],
      // since children are before parents, no one will see data below them
      op = {key: currRef, value: _.omit(obj, referenceProperty)};

    // omit cloned 1 level deep and we clear what omit cloned from obj
    //  so the op gets the first level of data, but it's removed from the main obj
    clearOwnProperties(obj);
    obj[referenceProperty] = currRef;

    return op;
  });

  // add the cleaned root object at the end
  ops.push({key: ref, value: data});

  return ops;
}

/**
 * Get a list of all the put operations needed to complete a cascading PUT
 * @param {string} ref
 * @param {object} data
 * @returns {Promise}
 */
function getPutOperations(ref, data) {
  return bluebird.map(splitCascadingData(ref, data), function (op) {
    // run each through the normal put, which may or may not hit custom component logic
    return put(op.key, op.value);
  }).then(function (ops) {
    // flatten to list of final batch ops
    return _.filter(_.flattenDeep(ops), _.identity);
  });
}

/**
 * @param {string} ref
 * @param {object} data
 * @returns {Promise}
 */
function cascadingPut(ref, data) {
  // potentially propagate version throughout object
  replacePropagatingVersions(ref, data);

  // split data into pieces
  return getPutOperations(ref, data)
    .then(function (ops) {
      // return ops if successful
      return db.batch(ops).return(ops);
    }).then(function (ops) {
      // return the value of the last batch operation (the root object) if successful
      var rootOp = _.last(ops);

      return rootOp && JSON.parse(rootOp.value);
    });
}

/**
 * Delete component data.
 *
 * Gets old values, so we can return them when the thing is deleted
 * @param {string} ref
 * @returns {Promise}
 */
function del(ref) {
  return get(ref).then(function (oldData) {
    var promise,
      componentModule = files.getComponentModule(getName(ref));

    if (componentModule && _.isFunction(componentModule.del)) {
      promise = componentModule.del(ref);
    } else {
      promise = db.del(ref);
    }

    return promise.return(oldData);
  });
}

/**
 * @param {string} ref
 * @param {object} data
 * @returns {Promise.object}
 */
function post(ref, data) {
  ref += '/' + uid();
  return cascadingPut(ref, data).then(function (result) {
    result._ref = ref;
    return result;
  });
}

/**
 *
 * @param {string} ref
 * @returns {object}
 */
function getSchema(ref) {
  return bluebird.try(function () {
    var componentName = getName(ref);

    return schema.getSchema(files.getComponentPath(componentName));
  });
}

/**
 * Check root of their project, or the 1st level of their node_modules
 *
 * @param {string} ref
 * @returns {string}
 */
function getPossibleTemplates(ref) {
  var filePath = files.getComponentPath(ref);

  if (_.isString(filePath)) {
    if (_.contains(filePath, 'node_modules')) {
      return [path.join(filePath, require(filePath + '/package.json').template)];
    } else {
      filePath = path.join(filePath, config.get('names.template'));
      return glob.sync(filePath + '.*');
    }
  }
  return [];
}

/**
 *
 * @param {string} ref
 * @returns {*}
 */
function getTemplate(ref) {
  var possibleTemplates;

  // if there are slashes in this name, they've given us a reference like /components/name/instances/id
  if (ref.indexOf('/') !== -1) {
    ref = getName(ref);
  }

  possibleTemplates = getPossibleTemplates(ref);

  if (!possibleTemplates.length) {
    throw new Error('No template files found for ' + ref);
  }

  // return the first template found
  return possibleTemplates[0];
}

// outsiders can act on components too
module.exports.get = get;
module.exports.put = cascadingPut; // special: could lead to multiple put operations
module.exports.del = del;
module.exports.post = post;

// maybe server.js people want to reach in and reuse these?
module.exports.putLatest = putLatest;
module.exports.putPublished = putPublished;
module.exports.putTag = putTag;
module.exports.putDefaultBehavior = putDefaultBehavior;

module.exports.getTemplate = getTemplate;
module.exports.getName = getName;
module.exports.getSchema = getSchema;

module.exports.getPutOperations = getPutOperations;
