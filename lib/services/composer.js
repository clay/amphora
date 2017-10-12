'use strict';

const _ = require('lodash'),
  bluebird = require('bluebird'),
  components = require('./components'),
  references = require('./references'),
  mapLayoutToPageData = require('../utils/layout-to-page-data'),
  referenceProperty = '_ref';


/**
 * Enables us to exclude certain components based on query parameter.
 *
 * Returns a function that can filter reference objects
 * based on `locals`.
 *
 * `article` matches `/components/article/instances/foo` as well as `/components/layout/instances/article`,
 * but `/components/article/instances/foo` matches only `/components/article/instances/foo`
 *
 * Uses `locals.query[locals.site.excludeKey]` as a string or array of strings used to filter
 * using `String.protototype.includes`.
 *
 * Does no filtering if `excludeUsingQueryParam` is not set in the site config.
 *
 * @param {Object} [locals]
 * @param {Object} [locals.site]
 * @param {string|string[]} [locals.site.excludeUsingQueryParam] name of query parameter used to exclude components
 * @param {Object} [locals.query]
 * @returns {Function}
 */
function excludeComponents(locals) {
  if (!locals || !locals.site || !locals.site.excludeUsingQueryParam || !locals.query || !locals.query[locals.site.excludeUsingQueryParam]) {
    return () => true;
  }

  const excludeKey = locals.site.excludeUsingQueryParam,
    exclude = locals.query[excludeKey];

  return function filter(referenceObject) {
    const ref = referenceObject[referenceProperty];

    if (typeof exclude === 'string') {
      return !ref.includes(exclude);
    } else if (Array.isArray(exclude)) {
      return !exclude.some(excludeStr => ref.includes(excludeStr));
    } else {
      return true;
    }
  };
}

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

  return bluebird.all(referenceObjects)
    .filter(excludeComponents(locals))
    .each(function (referenceObject) {
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
    })
    .return(data);
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


module.exports.resolveComponentReferences = resolveComponentReferences;
module.exports.composePage = composePage;
