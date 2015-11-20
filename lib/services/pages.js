'use strict';

var _ = require('lodash'),
  db = require('../services/db'),
  bluebird = require('bluebird'),
  composer = require('../composer'),
  references = require('../services/references'),
  uid = require('../uid'),
  components = require('../services/components');

/**
 * @param {string} uri
 * @param {{}} data
 * @param {[]} ops
 */
function addOp(uri, data, ops) {
  ops.push({
    type: 'put',
    key: uri,
    value: JSON.stringify(data)
  });

  return ops;
}

/**
 * True of reference object has a string in _ref that includes "/instances/"
 * @param {object} data
 * @returns {boolean}
 */
function isInstanceReferenceObject(data) {
  return _.isString(data._ref) && data._ref.indexOf('/instances/') > -1;
}

/**
 * Get a reference that is unique, but of the same component type as original.
 * @param {string} uri
 * @returns {string}
 */
function renameReferenceUniquely(uri) {
  var prefix = uri.substr(0, uri.indexOf('/components/'));

  return prefix + '/components/' + components.getName(uri) + '/instances/' + uid();
}

/**
 * Clone all instance components that are referenced by this page data, and maintain the data's object structure.
 *
 * @param {object} pageData
 * @param {object} [locals]
 * @returns {Promise}
 */
function getPageClonePutOperations(pageData, locals) {
  return bluebird.all(_.reduce(pageData, function (promises, pageValue, pageKey) {
    if (typeof pageValue === 'string' && components.getName(pageValue)) {
      //for all strings that are component references
      promises.push(components.get(pageValue, locals).then(function (refData) {
        //only follow the paths of instance references.  Don't clone default components
        return composer.resolveDataReferences(refData, isInstanceReferenceObject);
      }).then(function (resolvedData) {
        //for each instance reference within resolved data
        _.each(_.listDeepObjects(resolvedData, isInstanceReferenceObject), function (obj) {
          obj._ref = renameReferenceUniquely(obj._ref);
        });

        //rename reference in pageData
        var ref = renameReferenceUniquely(pageValue);
        pageData[pageKey] = ref;

        //put new data using cascading PUT at place that page now points
        return components.getPutOperations(ref, resolvedData, locals);
      }));
    } else if (typeof pageValue === 'object') {
      //for all object-like things (i.e., objects and arrays)
      promises = promises.concat(getPageClonePutOperations(pageValue, locals));
    }
    return promises;
  }, [])).then(_.flatten); //only one level of flattening needed
}

/**
 * Applies operations, then returns last (root) op's value.
 *
 * @param {[{type: string, key: string, value: string}]} ops
 */
function applyBatch(ops) {
  var lastOp = _.last(ops),
    lastValue = lastOp && JSON.parse(lastOp.value);

  return db.batch(ops).return(lastValue);
}

/**
 * Replace the referenced things in the page data with a different version
 * @param {object} data
 * @param {string} version
 * @returns object
 */
function replacePageReferenceVersions(data, version) {
  var replaceVersion = _.partial(references.replaceVersion, _, version);

  return _.mapValues(data, function (value) {
    if (typeof value === 'string') {
      return replaceVersion(value);
    } else if (_.isArray(value)) {
      return _.map(value, replaceVersion);
    } else {
      return value;
    }
  });
}

/**
 * Get latest data of uri@latest
 * @param {string} uri
 * @returns {Promise}
 */
function getLatestData(uri) {
  return db.get(references.replaceVersion(uri)).then(JSON.parse);
}

/**
 * Get a list of all operations with all references converted to @published
 * @returns {function}
 */
function getRecursivePublishedPutOperations(locals) {
  return function (rootComponentRef) {
    const published = 'published';

    /**
     * 1) Get reference (could be latest, could be other)
     * 2) Get all references within reference
     * 3) Replace all references with @published (including root reference)
     * 4) Get list of put operations needed
     */
    return components.get(rootComponentRef, locals)
      .then(composer.resolveDataReferences)
      .then(references.replaceAllVersions(published))
      .then(function (data) {
        return components.getPutOperations(references.replaceVersion(rootComponentRef, published), data, locals);
      });
  };
}

/**
 * Get latest data of uri@latest
 * @param {string} uri
 * @param {object} data
 * @param {object} [locals]
 * @returns {Promise}
 */
function publish(uri, data, locals) {
  return bluebird.try(function () {
    return data || getLatestData(uri);
  }).then(function (data) {
    const published = 'published';

    return bluebird.map(_.flatten(_.values(data)), getRecursivePublishedPutOperations(locals))
      .then(_.flatten) // only one level of flattening needed, because getPutOperations should have flattened its list already
      .then(function (ops) {
        // convert the data to all @published
        data = replacePageReferenceVersions(data, published);
        // add page PUT operation last
        return addOp(references.replaceVersion(uri, published), data, ops);
      });
  }).then(applyBatch);
}

/**
 * First draft
 * @param {string} uri
 * @param {object} data
 * @param {object} [locals]
 * @returns {Promise}
 */
function create(uri, data, locals) {
  var layoutReference = data && data.layout,
    pageData = data && _.omit(data, 'layout'),
    prefix = uri.substr(0, uri.indexOf('/pages')),
    pageReference = prefix + '/pages/' + uid();

  if (!layoutReference) {
    throw new Error('Client: Data missing layout reference.');
  }

  return components.get(layoutReference, locals).then(function () {

    return getPageClonePutOperations(pageData).then(function (ops) {
      pageData.layout = layoutReference;

      return addOp(pageReference, pageData, ops);
    });
  }).then(applyBatch).then(function (newPage) {
    // if successful, return new page object, but include the (optional) self reference to the new page.
    newPage._ref = pageReference;
    return newPage;
  });
}

module.exports.create = create;
module.exports.publish = publish;
module.exports.replacePageReferenceVersions = replacePageReferenceVersions;
