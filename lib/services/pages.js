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
 * Finds all strings on top-level of object that are component references, then replaces them with references
 * to cloned components built from their default data.
 *
 * @param {object} obj
 * @param {array} ops
 * @returns {Promise}
 */
function cloneDefaultComponents(obj, ops) {
  var promises = [];
  _.each(obj, function (value, key) {
    if (_.isString(value)) {
      var promise,
        componentName = components.getName(value);
      if (componentName) {
        promise = components.get('/components/' + componentName).then(function (componentData) {
          var componentInstance = '/components/' + componentName + '/instances/' + uid();
          addOp(componentInstance, componentData, ops);
          obj[key] = componentInstance;
        });
        promises.push(promise);
      }
    }
  });
  return bluebird.all(promises);
}

/**
 * Create new copies of components from defaults, on all levels (deep)
 * @param pageData
 * @returns Promise
 */
function cloneDefaultComponentsDeep(pageData) {
  var ops = [],
    list = _.listDeepObjects(pageData);
  list.push(pageData); //add self
  return bluebird.map(list, function (obj) {
    return cloneDefaultComponents(obj, ops);
  }).then(function () {
    return [pageData, ops];
  });
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

    return cloneDefaultComponentsDeep(pageData);
  }).spread(function (pageData, ops) {
    pageData.layout = layoutReference;

    addOp(pageReference, pageData, ops);

    return ops;
  }).then(applyBatch).then(function (newPage) {
    // if successful, return new page object, but include the (optional) self reference to the new page.
    newPage._ref = pageReference;
    return newPage;
  });
}

module.exports.create = create;
module.exports.publish = publish;