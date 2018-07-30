'use strict';

const _ = require('lodash'),
  bluebird = require('bluebird'),
  components = require('./components'),
  references = require('./references'),
  mapLayoutToPageData = require('../utils/layout-to-page-data'),
  referenceProperty = '_ref';
var log = require('./logger').setup({ file: __filename });

/**
 * Compose a component, recursively filling in all component references with
 * instance data.
 * @param {object} data
 * @param {object} locals  Extra data that some GETs use
 * @param {function|string} [filter='_ref']
 * @returns {Promise} - Resolves with composed component data
 */
function resolveComponentReferences(data, locals, filter = referenceProperty) {
  const referenceObjects = references.listDeepObjects(data, filter);

  return bluebird.all(referenceObjects).each(referenceObject => {
    return components.get(referenceObject[referenceProperty], locals)
      .then(obj => {
        // the thing we got back might have its own references
        return resolveComponentReferences(obj, locals, filter).finally(() => {
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
  }).then(() => data);
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
  return _.isString(obj[referenceProperty]) && obj[referenceProperty].indexOf('/instances/') !== -1;
}

module.exports.resolveComponentReferences = resolveComponentReferences;
module.exports.composePage = composePage;
module.exports.filterBaseInstanceReferences = filterBaseInstanceReferences;

// For testing
module.exports.setLog = (fakeLogger) => log = fakeLogger;
