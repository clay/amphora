'use strict';

const sites = require('./sites'),
  references = require('./references'),
  { getPrefix, isPage, isComponent, isLayout } = require('clayutils');

/**
 * gets the site's slug identifier from a site obj
 * @param {Object} site
 * @returns {string}
 */
function getSiteSlug(site) {
  return site && (site.subsiteSlug || site.slug);
}

/**
 * soft validation to make sure a uri is for the current site
 * @param {string} uri
 * @param {Object} locals
 * @throws {Error}
 */
function validateSite(uri, locals) {
  const uriSite = sites.getSiteFromPrefix(getPrefix(uri)),
    site = locals && locals.site,
    uriSlug = getSiteSlug(uriSite),
    siteSlug = getSiteSlug(site);

  if (!uriSite) {
    throw new Error(`Site for URI not found, ${uri}`);
  }

  if (!site) {
    throw new Error('Site not found on locals.');
  }

  if (uriSlug !== siteSlug) {
    throw new Error(`URI Site (${uriSlug}) not the same as current site (${siteSlug})`);
  }
}

/**
 * checks to see if a component property is a reference to another component
 * if it is, it validates that it is a valid reference
 * @param {Object} value
 * @param {Object} locals
 */
function isComponentReference(value, locals) {
  if (value && value._ref) {
    validateComponent(value._ref, value, locals);
  }
}

/**
 * soft validation for a component to make sure all references are for the same, current site.
 * @param {string} uri
 * @param {Object} data
 * @param {Object} locals
 */
function validateComponent(uri, data, locals) {
  // uri is from site
  validateSite(uri, locals);

  // check to see if this component references other components. if so, recursively validate that component
  if (data) {
    for (const [, value] of Object.entries(data)) {
      // if this is an object with a _ref property, verify _ref is for this site
      // ie:
      // property: { _ref: 'site.com/_components/test/instances/id' }
      isComponentReference(value, locals);

      // we can also  have arrays of references:
      // property: [
      //   { _ref: 'site.com/_components/test/instances/id-1' },
      //   { _ref: 'site.com/_components/test/instances/id-2' }
      // ]
      if (Array.isArray(value)) {
        for (let i = 0; i < value.length; i++) {
          isComponentReference(value[i], locals);
        }
      }
    }
  }
}

/**
 * soft validation for a page to make sure all references are for the same, current site.
 * @param {string} uri
 * @param {Object} data
 * @param {Object} locals
 */
function validatePage(uri, data, locals) {
  const layout = data && data.layout,
    componentList = references.getPageReferences(data);

  if (!uri || !isPage(uri)) {
    throw new Error(`Client: Page URI invalid, ${uri}`);
  }

  // page is for this site
  validateSite(uri, locals);

  if (!layout || !isLayout(layout)) {
    throw new Error('Client: Data missing layout reference.');
  }

  // check to make sure it's from this site
  validateSite(layout, locals);

  for (let i = 0; i < componentList.length; i++) {
    if (!isComponent(componentList[i])) {
      throw new Error(`Page references a non-valid component: ${componentList[i]}`);
    }

    validateSite(componentList[i], locals);
  }
}

module.exports.validateComponent = validateComponent;
module.exports.validatePage = validatePage;
