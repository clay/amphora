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
  glob = require('glob');

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

  return is.promise(promise, ref);
}

/**
 * PUT to just :id or @latest writes to both locations and creates a new version.
 * @param {string} ref   Assumes no @version
 * @param {object} data
 * @returns {Promise}
 */
function putLatest(ref, data) {
  data = JSON.stringify(data);
  return db.batch([
    { type: 'put', key: ref, value: data },
    { type: 'put', key: ref + '@latest', value: data },
    { type: 'put', key: ref + '@' + uid(), value: data}
  ]);
}

/**
 *
 * @param {string} ref   Assumes no @version
 * @param {object} data
 * @returns {Promise}
 */
function putPublished(ref, data) {
  data = JSON.stringify(data);
  return db.batch([
    { type: 'put', key: ref + '@published', value: data },
    { type: 'put', key: ref + '@' + uid(), value: data}
  ]);
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
  return db.batch([
    { type: 'put', key: ref + '@' + tag, value: data }
  ]);
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

  console.log('putting ' + ref, data);

  var promise,
    componentModule = files.getComponentModule(getName(ref));

  if (componentModule && _.isFunction(componentModule.put)) {
    promise = componentModule.put(ref, data);
  } else {
    promise = putDefaultBehavior(ref, data);
  }

  return is.promise(promise, ref).return(data).tap(function () {
    console.log('putted ', arguments);
  });
}

/**
 * Delete component data.
 *
 * Gets old values, so we can return them when the thing is deleted
 * @param {string} ref
 */
function del(ref) {


  //get old values, so we can return them when the thing is deleted.
  return get(ref).then(function (oldData) {
    var promise,
      componentModule = files.getComponentModule(getName(ref));

    if (componentModule && _.isFunction(componentModule.del)) {
      promise = componentModule.del(ref);
    } else {
      promise = db.del(ref);
    }

    return is.promise(promise, ref).return(oldData)
  });
}

/**
 * Find all _ref, and recursively expand them.
 *
 * TODO: schema validation here
 */
function resolveDataReferences(data) {
  var referenceProperty = '_ref',
    placeholders = _.listDeepObjects(data, referenceProperty);

  return bluebird.all(placeholders).each(function (placeholder) {
    return get(placeholder[referenceProperty]).then(function (obj) {
      //the thing we got back might have its own references
      return resolveDataReferences(obj).finally(function () {
        _.assign(placeholder, _.omit(obj, referenceProperty));
      });
    });
  }).return(data);
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
 *
 * @param {string} ref
 * @returns {*}
 */
function getTemplate(ref) {

  // if there are slashes in this name, they've given us a reference like /components/name/instances/id
  if (ref.indexOf('/') !== -1) {
    ref = getName(ref);
  }

  var filePath = files.getComponentPath(ref),
    possibleTemplates;

  if (_.contains(filePath, 'node_modules')) {
    possibleTemplates = [path.join(filePath, require(filePath + '/package.json').template)];
  } else {
    filePath = path.join(filePath, config.get('names.template'));
    possibleTemplates = glob.sync(filePath + '.*');
  }

  if (!possibleTemplates.length) {
    throw new Error('No template files found for ' + filePath);
  }

  // return the first template found
  return possibleTemplates[0];
}

//outsiders can act on components too
module.exports.get = get;
module.exports.put = put;
module.exports.del = del;

//maybe server.js people want to reach in and reuse these?
module.exports.putLatest = putLatest;
module.exports.putPublished = putPublished;
module.exports.putTag = putTag;
module.exports.putDefaultBehavior = putDefaultBehavior;

module.exports.resolveDataReferences = resolveDataReferences;
module.exports.getTemplate = getTemplate;
module.exports.getName = getName;