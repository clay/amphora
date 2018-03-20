'use strict';

const _ = require('lodash'),
  bluebird = require('bluebird'),
  components = require('./components'),
  references = require('./references'),
  scopeUtil = require('./scopes'),
  h = require('highland'),
  mapLayoutToPageData = require('../utils/layout-to-page-data'),
  REF_PROPERTY = '_ref';

/**
 * Compose a component, recursively filling in all component references with
 * instance data.
 * @param {object} data
 * @param {object} locals  Extra data that some GETs use
 * @param {object} [queryResults] Object mapping instance IDs to query results
 * @param {function|string} [filter]
 * @returns {Promise} - Resolves with composed component data
 */
function resolveComponentReferences(data, locals, queryResults, filter = REF_PROPERTY) {
  const referenceObjects = references.listDeepObjects(data, filter);

  return bluebird.all(referenceObjects).each(function (referenceObject) {
    const uri = referenceObject[REF_PROPERTY];

    return components.get(uri, locals, queryResults && queryResults[uri])
      .then(function (obj) {
        // the thing we got back might have its own references
        return resolveComponentReferences(obj, locals, queryResults, filter).finally(function () {
          _.assign(referenceObject, _.omit(obj, filter));
        }).catch(function (error) {
          // add additional information to the error message
          const wrappedError = new Error(error.message + ' within ' + referenceObject[REF_PROPERTY]);

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
    scopes = pageData._scopes,
    pageDataNoConf = references.omitPageConfiguration(pageData);

  return h(components.get(layoutReference))
    .map(layoutData => mapLayoutToPageData(pageDataNoConf, layoutData))
    .flatMap(fullData => scopeUtil.resolveScopes(scopes, locals)
      .map(queryResults => ({fullData, queryResults})))
    .flatMap(({fullData, queryResults}) =>
      h(resolveComponentReferences(fullData, locals, queryResults)))
    .toPromise(bluebird);
}

module.exports.resolveComponentReferences = resolveComponentReferences;
module.exports.composePage = composePage;
