'use strict';

const _ = require('lodash'),
  bluebird = require('bluebird'),
  components = require('./components'),
  references = require('./references'),
  mapLayoutToPageData = require('../utils/layout-to-page-data'),
  { getSchema } = require('../utils/schema'),
  { isLayout, isComponent } = require('clayutils'),
  referenceProperty = '_ref',
  renderOrderProperty = 'renderOrder',
  defaultRenderOrder = 1;
var log = require('./logger').setup({ file: __filename });

/**
 * Compose a component, recursively filling in all component references with
 * instance data.
 * @param {object} data
 * @param {object} locals  Extra data that some GETs use
 * @param {function|string} [filter='_ref']
 * @param {string} [uri]
 * @returns {Promise} - Resolves with composed component data
 */
function resolveComponentReferences(data, locals, filter = referenceProperty, uri) {
  const referenceObjects = references.listDeepValuesByKey(data, filter),
    schemaPromise = uri && Object.keys(referenceObjects).length && (isComponent(uri) || isLayout(uri)) ? getSchema(uri) : bluebird.resolve();

  return schemaPromise.then(schema => {
    const orderedRefs = orderReferences(referenceObjects, schema);

    return bluebird.each(orderedRefs, ([, referenceObject]) => {
      const ref = referenceObject[referenceProperty];

      return components.get(ref, locals)
        .then(obj => {
          // the thing we got back might have its own references
          return resolveComponentReferences(obj, locals, filter, ref).finally(() => {
            _.assign(referenceObject, _.omit(obj, referenceProperty));
          }).catch(function (error) {
            const logObj = {
              stack: error.stack,
              cmpt: referenceObject[referenceProperty]
            };

            if (error.status) {
              logObj.status = error.status;
            }

            log('error', `${error.message}`, logObj);

            return bluebird.reject(error);
          });
        });
    });
  }).then(() => data);
}

/**
 * Orders deep references based on the parent's schema.
 * @param {object} referenceObjects
 * @param {object} schema
 * @returns {array}
 */
function orderReferences(referenceObjects, schema) {
  const pairedRefs = _.toPairs(referenceObjects);

  if (schema) {
    // group and sort by orders from the schema
    return _.chain(pairedRefs)
      .groupBy(([path]) => {
        const splitPath = path.split('.');

        // remove array indexes
        if (!isNaN(splitPath[splitPath.length - 1])) {
          splitPath.pop();
        }

        return [
          _.get(schema, [...splitPath, '_componentList', renderOrderProperty]),
          _.get(schema, [...splitPath, '_component', renderOrderProperty]),
          defaultRenderOrder
        ].find(order => _.isNumber(order));
      })
      .toPairs()
      .sortBy(a => a[0])
      .map(a => a[1])
      .flatten()
      .value();
  } else {
    // if there's no schema, return original refs
    return pairedRefs;
  }
}

/**
 * Compose a page, recursively filling in all component references with
 * instance data.
 * @param  {object} pageData
 * @param  {object} locals
 * @return {Promise} - Resolves with composed page data
 */
function composePage(pageData, locals) {
  const layoutReference = pageData.layout,
    pageDataNoConf = references.omitPageConfiguration(pageData);

  return components.get(layoutReference)
    .then(layoutData => mapLayoutToPageData(pageDataNoConf, layoutData))
    .then(fullData => resolveComponentReferences(fullData, locals));
}

/**
 * True if object has a _ref and it is an instance
 * @param {Object} obj
 * @returns {Boolean}
 */
function filterBaseInstanceReferences(obj) {
  return _.isObject(obj) && _.isString(obj[referenceProperty]) && obj[referenceProperty].indexOf('/instances/') !== -1;
}

module.exports.resolveComponentReferences = resolveComponentReferences;
module.exports.composePage = composePage;
module.exports.filterBaseInstanceReferences = filterBaseInstanceReferences;
module.exports.referenceProperty = referenceProperty;

// For testing
module.exports.setLog = (fakeLogger) => log = fakeLogger;
module.exports.orderReferences = orderReferences;
