/**
 * Controller for Components
 *
 * @module
 */

'use strict';

let timeoutConstant = 4000;
const _ = require('lodash'),
  control = require('../control'),
  composer = require('./composer'),
  db = require('./db'),
  uid = require('../uid'),
  files = require('../files'),
  timer = require('../timer'),
  schema = require('../schema'),
  siteService = require('./sites'),
  references = require('./references'),
  bluebird = require('bluebird'),
  path = require('path'),
  glob = require('glob'),
  upgrade = require('./upgrade'),
  utils = require('../utils/components'),
  referenceProperty = '_ref',
  mediaDir = path.join(process.cwd(), 'public'), // TODO: We're hardcoding in the public dir. Check this
  timeoutGetCoefficient = 2,
  timeoutPutCoefficient = 5;
var log = require('./logger').setup({
  file: __filename
});

/**
 * @returns {number}
 */
function getTimeoutConstant() {
  return timeoutConstant;
}

/**
 * @param {number} value
 */
function setTimeoutConstant(value) {
  timeoutConstant = value;
}

/**
 * @param {string} uri
 * @param {object} [locals]
 * @returns {Promise}
 */
function get(uri, locals) {
  let promise,
    name = utils.getName(uri),
    componentModule = name && files.getComponentModule(name),
    callComponentHooks = _.get(locals, 'componenthooks') !== 'false',
    reqExtension = _.get(locals, 'extension'),
    renderModel = reqExtension && files.getComponentModule(name, reqExtension);

  // check for model.render() (plus no componenthooks flag)
  if (componentModule && _.isFunction(componentModule.render) && callComponentHooks) {
    const startTime = process.hrtime(),
      timeoutLimit = timeoutConstant * timeoutGetCoefficient;

    promise = bluebird.try(function () {
      return db.get(uri)
        .then(JSON.parse)
        .then(upgrade.init(uri, locals)) // Run an upgrade!
        .then(function (data) {
          return componentModule.render(uri, data, locals);
        });
    }).tap(function (result) {
      const ms = timer.getMillisecondsSince(startTime);

      if (!_.isObject(result)) {
        throw new Error('Component module must return object, not ' + typeof result + ': ' + uri);
      }

      if (ms > timeoutLimit * 0.5) {
        log('warn', `slow get ${uri} ${ms}ms`);
      }
    }).timeout(timeoutLimit, `Component module GET exceeded ${timeoutLimit}ms: ${uri}`);
  } else {
    promise = db.get(uri).then(JSON.parse).then(upgrade.init(uri, locals)); // Run an upgrade!
  }

  if (renderModel) {
    promise = promise.then(function (data) {
      return renderModel(uri, data, locals);
    });
  }

  return promise.then(function (data) {
    if (!_.isObject(data)) {
      throw new Error(`Client: Invalid data type for component at ${uri} of ${typeof data}`);
    }

    return data;
  });
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
 * @returns {Array}
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
 * @returns {Array}
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
 * @returns {Array}
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
  let result,
    componentModule = files.getComponentModule(utils.getName(uri)),
    callComponentHooks = _.get(locals, 'componenthooks') !== 'false';

  // check for model.save() (plus no componenthooks flag), or the deprecated server.put() syntax
  if (componentModule && (_.isFunction(componentModule.save) && callComponentHooks)) {
    const startTime = process.hrtime(),
      timeoutLimit = timeoutConstant * timeoutPutCoefficient;

    result = bluebird.try(function () {
      // model.js syntax, model.save should return an object (Promisified or regular)
      // THEN we create operations for the database batch
      return bluebird.resolve(componentModule.save(uri, data, locals)).then(function (resolvedData) {
        if (!_.isObject(resolvedData)) {
          throw new Error(`Unable to save ${uri}: Data from model.save must be an object!`);
        }

        return {
          key: uri,
          type: 'put',
          value: JSON.stringify(resolvedData)
        };
      });
    }).tap(function () {
      const ms = timer.getMillisecondsSince(startTime);

      if (ms > timeoutLimit * 0.5) {
        log('warn', `slow put ${uri} ${ms}ms`);
      }
    }).timeout(timeoutLimit, `Component module PUT exceeded ${timeoutLimit}ms: ${uri}`);
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
    return db.batch(ops).then(function () {
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

  return get(references.replaceVersion(uri), locals)
    .then(latestData => composer.resolveComponentReferences(latestData, locals, filterBaseInstanceReferences))
    .then(versionedData => cascadingPut(uri, versionedData, locals));
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
    let promise,
      componentModule = files.getComponentModule(utils.getName(uri));

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
 * @returns {Promise}
 */
function getSchema(uri) {
  return bluebird.try(function () {
    return schema.getSchema(files.getComponentPath(utils.getName(uri)));
  });
}

/**
 * Check root of their project, or the 1st level of their node_modules
 *
 * @param {string} name
 * @param {string} templateName  'template', 'apple', 'facebook'
 * @returns {string[]}  List of all templates available.
 */
function getPossibleTemplates(name, templateName) {
  const filePath = files.getComponentPath(name);

  if (_.isString(filePath)) {
    return glob.sync(path.join(filePath, templateName + '.*'));
  }

  return [];
}

/**
 * Get the first template found for a particular component
 * @param {string} name  i.e., 'article', 'paragraph', 'content', 'my-layout'
 * @param {string} templateName  i.e., 'template', 'apple', 'facebook'
 * @returns {string|undefined}
 */
function getTemplate(name, templateName) {

  if (!templateName) {
    throw new TypeError('Missing template name.');
  }

  // if there are slashes in this name, they've given us a reference like /components/name/instances/id
  if (name.indexOf('/') !== -1) {
    name = utils.getName(name);
  }

  // return the first template found
  return module.exports.getPossibleTemplates(name, templateName)[0];
}

/**
 * Loop through the provided object and find all
 * references to other components.
 *
 * @param {string} [ref]
 * @param {object} data
 * @returns {{refs: object, components: Array}}
 */
function getIndices(ref, data) {
  let components,
    refs = {};

  refs[ref] = data;
  _.assign(refs, _.keyBy(references.listDeepObjects(data, '_ref'), '_ref'));
  components = _.uniq(_.filter(_.map(Object.keys(refs), function (ref) { return utils.getName(ref); }), _.identity));

  return { refs, components };
}

/**
 * @param {string} name
 * @param {string} slug
 * @returns {array}
 */
function getStyles(name, slug) {
  const site = siteService.sites()[slug],
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
 * @returns {array}
 */
function getScripts(name, slug) {
  const site = siteService.sites()[slug],
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
module.exports.publish = publish;
module.exports.del = del;
module.exports.post = post;

// repeatable look-ups
module.exports.getName = utils.getName; // too large to memoize
module.exports.getTemplate = getTemplate; // too large to memoize
module.exports.getPossibleTemplates = control.memoize(getPossibleTemplates, joinArguments);
module.exports.getSchema = control.memoize(getSchema);
module.exports.getScripts = control.memoize(getScripts, joinArguments);
module.exports.getStyles = control.memoize(getStyles, joinArguments);

// data rearrangement
module.exports.getIndices = getIndices;
module.exports.getPutOperations = getPutOperations;

// dependency injection
module.exports.setTimeoutConstant = setTimeoutConstant;
module.exports.getTimeoutConstant = getTimeoutConstant;

// For testing
module.exports.setLog = function (fakeLogger) {
  log = fakeLogger;
};
