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
  glob = require('glob'),
  referenceProperty = '_ref',
  mediaDir = path.join(process.cwd(), 'public');

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
    name = getName(ref),
    componentModule = name && files.getComponentModule(name);

  if (_.isFunction(componentModule)) {
    promise = componentModule(ref, locals);
  } else {
    promise = db.get(ref).then(JSON.parse);
  }

  return promise;
}

/**
 * return a list of all components
 * @returns {array}
 */
function list() {
  return files.getComponents();
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
 * If the ref has a version that is "propagating" like @published or @latest, replace all versions in the data
 *  with the new version.
 * @param ref
 * @param data
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
    var ref = obj[referenceProperty],
      // since children are before parents, no one will see data below them
      op = {key: ref, value: _.omit(obj, referenceProperty)};

    // omit cloned 1 level deep and we clear what omit cloned from obj
    //  so the op gets the first level of data, but it's removed from the main obj
    clearOwnProperties(obj);
    obj[referenceProperty] = ref;

    return op;
  });

  // add the cleaned root object at the end
  ops.push({key: ref, value: data});

  return ops;
}

/**
 * Get a list of all the put operations needed to complete a cascading PUT
 *
 * NOTE: this function changes the data object _in-place_ for speed and memory reasons. We are not okay with doing
 * a deep clone here, because that will significantly slow down this operation.  If someone wants to deep clone the data
 * before this operation, they can.
 *
 * @param {string} ref
 * @param {object} data
 * @returns {Promise}
 */
function getPutOperations(ref, data) {
  // potentially propagate version throughout object
  replacePropagatingVersions(ref, data);

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
      filePath = path.join(filePath, 'template');
      return glob.sync(filePath + '.*');
    }
  }
  return [];
}

/**
 *
 * @param {string} ref
 * @returns {string}
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

/**
 * @param {string} [ref]
 * @param {object} data
 * @returns {{refs: object, components: Array}}
 */
function getIndices(ref, data) {
  var components,
    refs = {};

  refs[ref] = data;
  _.assign(refs, _.indexBy(_.listDeepObjects(data, '_ref'), '_ref'));
  components = _.filter(_.map(Object.keys(refs), function (ref) { return getName(ref); }), _.identity);

  return {
    refs: refs,
    components: components
  };
}

/**
 * @param {string} name
 * @param {string} slug
 */
function getStyles(name, slug) {
  return _.map(_.filter([
    path.join(mediaDir, 'css', name + '.css'),
    path.join(mediaDir, 'css', name + '.' + slug + '.css')
  ], files.fileExists), function (filePath) {
    return filePath.substr(mediaDir.length);
  });
}

/**
 * @param {string} name
 * @param {string} slug
 */
function getScripts(name, slug) {
  return _.map(_.filter([
    path.join(mediaDir, 'js', name + '.js'),
    path.join(mediaDir, 'js', name + '.' + slug + '.js')
  ], files.fileExists), function (filePath) {
    return filePath.substr(mediaDir.length);
  });
}

// outsiders can act on components too
module.exports.get = get;
module.exports.list = list;
module.exports.put = cascadingPut; // special: could lead to multiple put operations
module.exports.del = del;
module.exports.post = post;

// maybe server.js people want to reach in and reuse these?
module.exports.putLatest = putLatest;
module.exports.putPublished = putPublished;
module.exports.putTag = putTag;
module.exports.putDefaultBehavior = putDefaultBehavior;

// repeatable look-ups
module.exports.getTemplate = _.memoize(getTemplate);
module.exports.getName = _.memoize(getName);
module.exports.getSchema = _.memoize(getSchema);
module.exports.getScripts = _.memoize(getScripts);
module.exports.getStyles = _.memoize(getStyles);

// data rearrangement
module.exports.getIndices = getIndices;
module.exports.getPutOperations = getPutOperations;
