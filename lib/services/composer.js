'use strict';

const _ = require('lodash'),
  bluebird = require('bluebird'),
  components = require('./components'),
  references = require('./references'),
  mapLayoutToPageData = require('../utils/layout-to-page-data'),
  clayUtils = require('clayutils'),
  referenceProperty = '_ref';

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

  return bluebird.all(referenceObjects).each(function (referenceObject) {
    return components.get(referenceObject[referenceProperty], locals)
      .then(function (obj) {
        // the thing we got back might have its own references
        return resolveComponentReferences(obj, locals, filter).finally(function () {
          let componentUri = referenceObject[referenceProperty];

          referenceObject[referenceProperty] = componentUri.indexOf(`${locals.site.slug}/_`) > -1 ? clayUtils.uriSlugToPrefix(componentUri, locals.site) : componentUri;
          _.assign(referenceObject, _.omit(obj, referenceProperty));
        }).catch(function (error) {
          // add additional information to the error message
          const wrappedError = new Error(`${error.message} within ${referenceObject[referenceProperty]}`);

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

  return components.get(clayUtils.uriPrefixToSlug(layoutReference, locals.site), locals, false)
    .then(layoutData => mapLayoutToPageData(pageDataNoConf, locals.site, layoutData))
    .then(fullData => resolveComponentReferences(fullData, locals));
}


module.exports.resolveComponentReferences = resolveComponentReferences;
module.exports.composePage = composePage;
