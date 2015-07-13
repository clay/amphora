'use strict';

var _ = require('lodash'),
  db = require('../services/db'),
  bluebird = require('bluebird'),
  composer = require('../composer'),
  references = require('../services/references'),
  uid = require('../uid'),
  components = require('../services/components');

/**
 * Get a list of the areas in a layout that have to be filled with pageData.
 * @param {{}} layoutData
 */
function findLayoutAreas(layoutData) {
  return _.reduce(_.listDeepObjects(layoutData, _.isArray), function (obj, areaList) {
    _.each(areaList, function (item) {
      if (_.isString(item)) {
        obj[item] = '';
      }
    });
    return obj;
  }, {});
}

/**
 * @throws if there are missing or extra pageData, with appropriate message
 * @param {{}} pageData
 * @param {{}} layoutData
 */
function validatePageData(pageData, layoutData) {
  var areas = findLayoutAreas(layoutData),
    diff = _.difference(Object.keys(areas), Object.keys(pageData));

  if (diff.length > 0) {
    throw new Error((_.has(areas, diff[0]) ? 'Missing' : 'Extra') + ' layout area: ' + diff[0]);
  }
}

/**
 * @param {string} ref
 * @param {{}} data
 * @param {[]} ops
 */
function addOp(ref, data, ops) {
  ops.push({
    type: 'put',
    key: ref,
    value: JSON.stringify(data)
  });
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
 * Clone all instance components that are referenced by this page data, and maintain the data's object structure.
 *
 * @param {object} pageData
 * @returns {Promise}
 */
function getPageClonePutOperations(pageData) {
  return bluebird.all(_.reduce(pageData, function (promises, pageValue, pageKey) {
    if (typeof pageValue === 'string' && components.getName(pageValue)) {
      //for all strings that are component references
      promises.push(components.get(pageValue).then(function (refData) {
        //only follow the paths of instance references.  Don't clone default components
        return composer.resolveDataReferences(refData, isInstanceReferenceObject);
      }).then(function (resolvedData) {
        //for each instance reference within resolved data
        _.each(_.listDeepObjects(resolvedData, isInstanceReferenceObject), function (obj) {
          obj._ref = '/components/' + components.getName(obj._ref) + '/instances/' + uid();
        });

        //rename reference in pageData
        var ref = '/components/' + components.getName(pageValue) + '/instances/' + uid();
        pageData[pageKey] = ref;

        //put new data using cascading PUT at place that page now points
        return components.getPutOperations(ref, resolvedData);
      }));
    } else if (typeof pageValue === 'object') {
      //for all object-like things (i.e., objects and arrays)
      promises = promises.concat(getPageClonePutOperations(pageValue));
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
 * @param {{}} data
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
 * Create new versions of all components and save to them all to @published
 *
 * @param {string} ref
 * @param {{}} data
 * @returns {Promise}
 */
function publish(ref, data) {
  var published = 'published',
    pageRefs = _.flatten(_.values(data));
  ref = references.replaceVersion(ref, published);
  data = replacePageReferenceVersions(data, published);

  return bluebird.map(pageRefs, function (pageRef) {
    /**
     * 1) Get reference (could be latest, could be other)
     * 2) Get all references within reference
     * 3) Replace all references with @published (including root reference)
     * 4) Get list of put operations needed
     */
    return components.get(pageRef)
      .then(composer.resolveDataReferences)
      .then(references.replaceAllVersions(published))
      .then(function (data) {
        return [references.replaceVersion(pageRef, published), data];
      })
      .spread(components.getPutOperations);
  }).then(_.flatten) // only one level of flattening needed, because getPutOperations should have flattened its list already
    .then(function (ops) {
      // add page PUT operation last
      addOp(ref, data, ops);
      return ops;
    }).then(applyBatch);
}

/**
 * First draft
 * @param {string} ref  Currently unused; saving for later for consistency with other functions
 * @param {{}} data
 * @returns {Promise}
 */
function create(ref, data) {
  var layoutReference = data && data.layout,
    pageData = data && _.omit(data, 'layout'),
    pageReference = '/pages/' + uid();

  if (!layoutReference) {
    throw new Error('Client: Data missing layout reference.');
  }

  return components.get(layoutReference).then(function (layoutData) {

    validatePageData(pageData, layoutData);

    return getPageClonePutOperations(pageData).then(function (ops) {
      pageData.layout = layoutReference;

      addOp(pageReference, pageData, ops);

      return ops;
    });
  }).then(applyBatch).then(function (newPage) {
    // if successful, return new page object, but include the (optional) self reference to the new page.
    newPage._ref = pageReference;
    return newPage;
  });
}

module.exports.create = create;
module.exports.publish = publish;