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
 * soft validation for a component to make sure all references are for the same, current site.
 * @param {string} uri
 * @param {Object} data
 * @param {Object} locals
 */
function validateComponent(uri, data, locals) {
  // uri is from site
  validateSite(uri, locals);

  // make sure all _refs are for the same current site
  if (data) {
    const refs = references.listDeepObjects(data, '_ref');

    for (const ref of refs) {
      validateComponent(ref._ref, ref, locals);
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
    throw new Error(`Page URI invalid, '${uri}'`);
  }

  // page is for this site
  validateSite(uri, locals);

  if (!layout || !isLayout(layout)) {
    throw new Error('Page must contain a `layout` property whose value is a `_layouts` instance');
  }

  // check to make sure it's from this site
  validateSite(layout, locals);

  for (let i = 0; i < componentList.length; i++) {
    if (!isComponent(componentList[i])) {
      throw new Error(`Page references a non-valid component: ${componentList[i]}`);
    }

    validateComponent(componentList[i], null, locals);
  }
}

module.exports.validateSite = validateSite;
module.exports.validateComponent = validateComponent;
module.exports.validatePage = validatePage;
