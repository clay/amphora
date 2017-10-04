'use strict';

const _ = require('lodash'),
  components = require('./services/components');

/**
 * @param {Array} list
 * @param {function} fn
 * @returns {Array}
 */
function flatMap(list, fn) {
  return _.filter(_.flattenDeep(_.map(list, fn)), _.identity);
}

/**
 * Gets a list of all css and js needed for the components listed.
 *
 * NOTE: the getStyles and getScripts are memoized using all arguments
 *
 * @param {Array} componentList
 * @param {string} slug
 * @returns {{styles: Array, scripts: Array}}
 */
function getMediaMap(componentList, slug) {
  return {
    styles: flatMap(componentList, function (component) {
      return components.getStyles(component, slug);
    }),
    scripts: flatMap(componentList, function (component) {
      return components.getScripts(component, slug);
    })
  };
}

/**
 *
 * @param {Array} componentList
 * @param {object} data
 * @param {object} locals
 * @param {object} locals.site
 * @returns {{styles: Array, scripts: Array}}
 */
function addMediaMap(componentList, data, locals) {
  let { site } = locals, mediaMap;

  if (!_.has(site, 'slug')) {
    throw new TypeError('Locals with site slug are required to add media map.');
  }

  mediaMap = getMediaMap(componentList, site.slug);

  // allow site to change the media map before applying it
  if (_.isFunction(site.resolveMedia)) {
    mediaMap = site.resolveMedia(mediaMap, locals) || mediaMap;
  }

  return mediaMap;
}

module.exports.getMediaMap = getMediaMap;
module.exports.addMediaMap = addMediaMap;
