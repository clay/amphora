'use strict';

const sites = require('./sites'),
  references = require('./references'),
  { getPrefix, isPage, isComponent, isLayout } = require('clayutils');

/**
 * 
 * @param {string} uri
 * @param {Object} locals
 * @throws {Error}
 * @returns {boolean}
 */
function validateSite(uri, locals) {
  const uriSite = sites.getSiteFromPrefix(getPrefix(uri)),
    site = locals && locals.site;

  if (!uriSite) {
    throw new Error(`Site for URI not found, ${uri}`);
  }

  if (!site) {
    throw new Error('Site not found on locals.');
  }

  const uriSlug = uriSite.subsiteSlug || uriSite.slug,
    siteSlug = site.subsiteSlug || site.slug;

  if (uriSlug !== siteSlug) {
    throw new Error(`URI Site (${uriSlug}) not the same as current site (${siteSlug})`);
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

  // all references are from site
}

/**
 * soft validation for a page to make sure all references are for the same, current site.
 * @param {string} uri
 * @param {Object} data
 * @param {Object} locals
 */
function validatePage(uri, data, locals) {
  if (!uri || !isPage(uri)) {
    throw new Error(`Client: Page URI invalid, ${uri}`);
  }

  // page is for this site
  validateSite(uri, locals);

  // page has a layout
  const layout = data && data.layout;

  if (!layout || !isLayout(layout)) {
    throw new Error('Client: Data missing layout reference.');
  }

  // check to make sure it's from this site
  validateSite(layout, locals);

  // all component references are valid and are from this site
  const componentList = references.getPageReferences(data);

  for (let i = 0; i < componentList.length; i++) {
    if (!isComponent(componentList[i])) {
      throw new Error(`Page references a non-valid component: ${componentList[i]}`);
    }

    validateSite(componentList[i], locals);
  }
}

module.exports.validateComponent = validateComponent;
module.exports.validatePage = validatePage;
