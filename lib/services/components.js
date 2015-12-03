/**
 * Controller for Components
 *
 * @module
 */

'use strict';

var _ = require('lodash'),
  control = require('../control'),
  db = require('./db'),
  uid = require('../uid'),
  files = require('../files'),
  schema = require('../schema'),
  siteService = require('./sites'),
  references = require('./references'),
  bluebird = require('bluebird'),
  path = require('path'),
  glob = require('glob'),
  referenceProperty = '_ref',
  mediaDir = path.join(process.cwd(), 'public');

/**
 * Takes a ref, and returns the component name within it.
 * @param {string} uri
 * @returns {string}
 * @example /components/base  returns base
 * @example /components/text/instances/0  returns text
 * @example /components/image.html  returns image
 */
function getName(uri) {
  var result = /components\/(.+?)[\/\.@]/.exec(uri) || /components\/(.+)/.exec(uri);

  return result && result[1];
}

/**
 * @param {string} uri
 * @param {object} [locals]
 */
function get(uri, locals) {
  var promise,
    name = getName(uri),
    componentModule = name && files.getComponentModule(name);

  if (_.isFunction(componentModule)) {
    promise = componentModule(uri, locals);
  } else {
    promise = db.get(uri).then(JSON.parse);
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
 * @param {string} uri   Assumes no @version
 * @param {object} data
 * @returns {Promise}
 */
function putLatest(uri, data) {
  data = JSON.stringify(data);
  return [
    { type: 'put', key: references.replaceVersion(uri), value: data }
  ];
}

/**
 *
 * @param {string} uri   Assumes no @version
 * @param {object} data
 * @returns {Promise}
 */
function putPublished(uri, data) {
  data = JSON.stringify(data);
  return [
    { type: 'put', key: references.replaceVersion(uri, 'published'), value: data }
  ];
}

/**
 *
 * @param {string} uri  Assumes no @version
 * @param {object} data
 * @param {string} tag  unique tag
 * @returns {Promise}
 */
function putTag(uri, data, tag) {
  data = JSON.stringify(data);
  return [
    { type: 'put', key: references.replaceVersion(uri, tag), value: data }
  ];
}

/**
 *
 * @param {string} uri
 * @param {object} data
 * @returns {Promise}
 */
function putDefaultBehavior(uri, data) {
  const split = uri.split('@'),
    path = split[0],
    version = split[1];

  if (version) {
    switch (version) {
      case 'published':
        return putPublished(path, data);
      case 'latest':
        return putLatest(path, data);
      default:
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
  var result,
    componentModule = files.getComponentModule(getName(uri));

  if (componentModule && _.isFunction(componentModule.put)) {
    result = componentModule.put(uri, data, locals);
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

  return bluebird.map(components, function (op) {
    // run each through the normal put, which may or may not hit custom component logic
    return put(op.key, op.value, locals);
  }).then(function (ops) {
    // flatten to list of final batch ops
    return _.filter(_.flattenDeep(ops), _.identity);
  });
}

/**
 * @param {string} uri
 * @param {object} data
 * @param {object} [locals]
 * @returns {Promise}
 */
function cascadingPut(uri, data, locals) {
  // split data into pieces
  return getPutOperations(uri, data, locals)
    .then(function (ops) {
      // return ops if successful
      return db.batch(ops).return(ops);
    })
    .then(function (ops) {
      // return the value of the last batch operation (the root object) if successful
      const rootOp = _.last(ops);

      return rootOp && JSON.parse(rootOp.value);
    });
}

/**
 * Delete component data.
 *
 * Gets old values, so we can return them when the thing is deleted
 * @param {string} uri
 * @param {object} [locals]
 * @returns {Promise}
 */
function del(uri, locals) {
  return get(uri).then(function (oldData) {
    var promise,
      componentModule = files.getComponentModule(getName(uri));

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
  return cascadingPut(uri, data, locals).then(function (result) {
    result._ref = uri;
    return result;
  });
}

/**
 * @param {string} uri
 */
function getSchema(uri) {
  return bluebird.try(function () {
    return schema.getSchema(files.getComponentPath(getName(uri)));
  });
}

/**
 * Check root of their project, or the 1st level of their node_modules
 *
 * @param {string} name
 * @returns {[string]}  List of all templates available.
 */
function getPossibleTemplates(name) {
  var pkg, filePath = files.getComponentPath(name);

  if (_.isString(filePath)) {
    if (_.contains(filePath, 'node_modules')) {
      pkg = files.getComponentPackage(name);

      if (pkg && _.isString(pkg.template)) {
        // assume they know where their own template is and that it exists
        return [path.join(filePath, pkg.template)];
      }
    }

    // local components will not have a package.json, and thus are always at 'template.*'
    filePath = path.join(filePath, 'template');
    return glob.sync(filePath + '.*');
  }
  return [];
}

/**
 * Get the first template found for a particular component
 * @param {string} name  i.e., 'article', 'paragraph', 'content', 'my-layout'
 * @returns {string}
 */
function getTemplate(name) {

  // if there are slashes in this name, they've given us a reference like /components/name/instances/id
  if (name.indexOf('/') !== -1) {
    name = getName(name);
  }

  var possibleTemplates = getPossibleTemplates(name);

  if (!possibleTemplates.length) {
    throw new Error('No template files found for ' + name);
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
  components = _.uniq(_.filter(_.map(Object.keys(refs), function (ref) { return getName(ref); }), _.identity));

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
  var site = siteService.sites()[slug],
    assetDir = site && site.assetDir || mediaDir,
    assetDirLen = assetDir.length,
    assetPath = site && site.assetPath || '';

  return _.map(_.filter([
    path.join(assetDir, 'css', name + '.css'),
    path.join(assetDir, 'css', name + '.' + slug + '.css')
  ], files.fileExists), function (filePath) {
    return path.join(assetPath, filePath.substr(assetDirLen));
  });
}

/**
 * @param {string} name
 * @param {string} slug
 */
function getScripts(name, slug) {
  var site = siteService.sites()[slug],
    assetDir = site && site.assetDir || mediaDir,
    assetDirLen = assetDir.length,
    assetPath = site && site.assetPath || '';

  return _.map(_.filter([
    path.join(assetDir, 'js', name + '.js'),
    path.join(assetDir, 'js', name + '.' + slug + '.js')
  ], files.fileExists), function (filePath) {
    return path.join(assetPath, filePath.substr(assetDirLen));
  });
}

/**
 * Join all the arguments into a large string seperated by '.'
 *
 * @returns {string}
 */
function joinArguments() {
  return _.slice(arguments).join('.');
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
module.exports.getScripts = _.memoize(getScripts, joinArguments);
module.exports.getStyles = _.memoize(getStyles, joinArguments);

// data rearrangement
module.exports.getIndices = getIndices;
module.exports.getPutOperations = getPutOperations;
