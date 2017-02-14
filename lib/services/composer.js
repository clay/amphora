'use strict';

const _ = require('lodash'),
  bluebird = require('bluebird'),
  components = require('./components'),
  references = require('./references'),
  referenceProperty = '_ref';


/**
 * Compose a component, recursively filling in all component references with
 * instance data.
 * @param {object} data
 * @param {object} locals  Extra data that some GETs use
 * @param {function|string} [filter='_ref']
 * @returns {Promise} - Resolves with composed component data
 */
function resolveComponentReferences(data, locals, filter) {
  const referenceObjects = references.listDeepObjects(data, filter || referenceProperty);

  return bluebird.all(referenceObjects).each(function (referenceObject) {
    return components.get(referenceObject[referenceProperty], locals)
      .then(function (obj) {
        // the thing we got back might have its own references
        return resolveComponentReferences(obj, locals, filter).finally(function () {
          _.assign(referenceObject, _.omit(obj, referenceProperty));
        }).catch(function (error) {
          // add additional information to the error message
          const wrappedError = new Error(error.message + ' within ' + referenceObject[referenceProperty]);

          wrappedError.name = error.name;
          throw wrappedError;
        });
      });
  }).return(data);
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
    // require here because otherwise it's a circular dependency (via html-composer)
    .then(layoutData => require('../html-composer').mapLayoutToPageData(pageDataNoConf, layoutData))
    .then(fullData => resolveComponentReferences(fullData, locals));
}


module.exports.resolveComponentReferences = resolveComponentReferences;
module.exports.composePage = composePage;
