/**
 * Controller for Components
 *
 * @module
 */

'use strict';

var _ = require('lodash'),
  db = require('../db'),
  uid = require('../uid'),
  responses = require('../responses'),
  composer = require('../composer'),
  files = require('../files'),
  schema = require('../schema'),
  queryStringOptions = ['ignore-data'],
  bluebird = require('bluebird'),
  is = require('../assert-is'),
  path = require('path'),
  config = require('config'),
  glob = require('glob'),
  acceptedExtensions = {
    html: 'text/html',
    yaml: 'text/yaml',
    json: 'application/json'
  };

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
  var promise,
    componentModule = files.getComponentModule(getName(ref));

  if (componentModule && _.isFunction(componentModule.put)) {
    promise = componentModule.put(ref, data);
  } else {
    promise = putDefaultBehavior(ref, data);
  }

  return is.promise(promise, ref);
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

    return is.promise(promise, ref).return(oldData);
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

/**
 * Validation of component routes goes here.
 *
 * They will all have the form (req, res, next).
 *
 * @namespace
 */
let validation = {
  /**
   * If accepts type, run callback.
   */
  onlyAcceptExtension: function (req, res, next) {
    var type, isType,
      ext = req.params.ext.toLowerCase(),
      accepts = req.headers.accept,
      isAll = accepts.indexOf('*/*') !== -1;

    if (!acceptedExtensions[ext]) {
      return responses.notFound(res);
    }

    type = acceptedExtensions[ext];
    isType = accepts.indexOf(type) !== -1;

    if (!isAll && !isType) {
      responses.notAcceptable({accept: [type]})(req, res);
    } else {
      req.headers.accept = type;
      next();
    }
  },

  /**
   * If component doesn't exist, then the resource cannot be found.
   *
   * @param req
   * @param res
   * @param next
   */
  componentMustExist: function (req, res, next) {
    var name = req.params.name;
    name = name.split('@')[0];
    name = name.split('.')[0];

    if (!!files.getComponentPath(name)) {
      next();
    } else {
      responses.notFound(res);
    }
  }
};

/**
 * All routes go here.
 *
 * They will all have the form (req, res), but never with next()
 *
 * @namespace
 */
let route = {

  /**
   * @param req
   * @param res
   */
  get: function (req, res) {
    responses.expectJSON(function () {
      return get(responses.normalizePath(req.baseUrl + req.url));
    }, res);
  },

  /**
   * @param req
   * @param res
   */
  put: function (req, res) {
    responses.expectJSON(function () {
      return put(responses.normalizePath(req.baseUrl + req.url), req.body);
    }, res);
  },

  /**
   * @param req
   * @param res
   */
  del: function (req, res) {
    responses.expectJSON(function () {
      return put(responses.normalizePath(req.baseUrl + req.url), req.body);
    }, res);
  },

  /**
   * Change the acceptance type based on the extension they gave us
   *
   * Fail if they don't accept right protocol and not *
   *
   * @param req
   * @param res
   */
  extension: function (req, res) {
    switch (req.params.ext.toLowerCase()) {
      case 'html':
        return this.render(req, res);
      case 'yaml':
        return responses.notImplemented(req, res);
      case 'json': // jshint ignore:line
      default:
        return this.get(req, res);
    }
  },

  /**
   * Return a schema for a component
   *
   * @param req
   * @param res
   */
  schema: function (req, res) {
    responses.expectJSON(function () {
      return getSchema(responses.normalizePath(req.baseUrl + req.url));
    }, res);
  },

  render: function (req, res) {
    responses.expectHTML(function () {
      return composer.renderComponent(responses.normalizePath(req.baseUrl + req.url), res, _.pick(req.query, queryStringOptions));
    }, res);
  }
};

function routes(router) {
  router.all('/', responses.methodNotAllowed({allow: ['get']}));
  router.get('/', responses.notImplemented);

  router.all('/:name*', validation.componentMustExist);
  router.get('/:name.:ext', validation.onlyAcceptExtension);
  router.get('/:name.:ext', route.extension);

  router.all('/:name@:version', responses.acceptJSONOnly);
  router.all('/:name@:version', responses.methodNotAllowed({allow: ['get', 'put']}));
  router.get('/:name@:version', route.get);
  router.put('/:name@:version', route.put);

  router.all('/:name', responses.acceptJSONOnly);
  router.all('/:name', responses.methodNotAllowed({allow: ['get', 'put', 'delete']}));
  router.get('/:name', route.get);
  router.put('/:name', route.put);
  router.delete('/:name', route.del);

  router.all('/:name/instances', responses.acceptJSONOnly);
  router.all('/:name/instances', responses.methodNotAllowed({allow: ['get']}));
  router.get('/:name/instances', responses.listWithoutVersions());
  router.get('/:name/instances/:id.:ext', validation.onlyAcceptExtension);
  router.get('/:name/instances/:id.:ext', route.extension);

  router.all('/:name/instances/:id@:version', responses.acceptJSONOnly);
  router.all('/:name/instances/:id@:version', responses.methodNotAllowed({allow: ['get', 'put']}));
  router.get('/:name/instances/:id@:version', route.get);
  router.put('/:name/instances/:id@:version', route.put);

  router.all('/:name/instances/:id', responses.acceptJSONOnly);
  router.all('/:name/instances/:id', responses.methodNotAllowed({allow: ['get', 'put', 'delete']}));
  router.get('/:name/instances/:id', route.get);
  router.put('/:name/instances/:id', route.put);
  router.delete('/:name/instances/:id', route.del);

  router.all('/:name/schema', responses.methodNotAllowed({allow: ['get']}));
  router.get('/:name/schema', route.schema);
}

module.exports = routes;

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