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
  bluebird = require('bluebird'),
  is = require('../assert-is'),
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
 * @param ref
 * @param locals
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
 * @param {} tag  unique tag
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
 * @param ref
 * @param data
 * @returns {Promise}
 */
function putDefaultBehavior(ref, data) {
  let split = ref.split('@'),
    path = split[0],
    version = split[1];

  if (version) {
    switch (version) {
      case 'list':
        throw new Error('Cannot PUT to @list.');
      case 'latest':
        return putLatest(path, data);
      case 'published':
        return putPublished(path, data);
      default:
        return putTag(path, data, version);
    }
  } else {
    return putLatest(path, data);
  }
}

/**
 * @param ref
 * @param data
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
 * @param {string} ref
 * @param {object} data
 * @returns {Promise.object}
 */
function cascadingPut(ref, data) {
  //search for _ref with _size greater than 1
  var ops = [],
    deepObjects = _.listDeepObjects(data, isReferencedAndReal);

  //reverse; children should be before parents
  _.each(deepObjects.reverse(), function (obj) {
    var ref = obj[referenceProperty];

    // since children are before parents, no one will see data below them
    ops.push({key: ref, value: _.omit(obj, referenceProperty)});

    // omit cloned 1 level deep and we clear what omit cloned from obj
    //  so the op gets the first level of data, but it's removed from the main obj
    clearOwnProperties(obj);
    obj[referenceProperty] = ref;
  });

  //add the cleaned root object at the end
  ops.push({key: ref, value: data});

  return bluebird.map(ops, function (op) {
    //run each through the normal put, which may or may not hit custom component logic
    return put(op.key, op.value);
  }).then(function (ops) {
    //flatten to list of final batch ops
    return db.batch(_.filter(_.flattenDeep(ops), _.identity));
  }).return(data); //return root object if successful
}

/**
 * Delete component data.
 *
 * Gets old values, so we can return them when the thing is deleted
 * @param {string} ref
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
 * @returns [string]
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

  // if there are slashes in this name, they've given us a reference like /components/name/instances/id
  if (ref.indexOf('/') !== -1) {
    ref = getName(ref);
  }

  var possibleTemplates = getPossibleTemplates(ref);

  if (!possibleTemplates.length) {
    throw new Error('No template files found for ' + ref);
  }

  // return the first template found
  return possibleTemplates[0];
}

//outsiders can act on components too
module.exports.get = get;
module.exports.put = cascadingPut; //special: could lead to multiple put operations
module.exports.del = del;
module.exports.post = post;

//maybe server.js people want to reach in and reuse these?
module.exports.putLatest = putLatest;
module.exports.putPublished = putPublished;
module.exports.putTag = putTag;
module.exports.putDefaultBehavior = putDefaultBehavior;

module.exports.getTemplate = getTemplate;
module.exports.getName = getName;
module.exports.getSchema = getSchema;