'use strict';

const _ = require('lodash'),
  { uriSwapOutSlug } = require('../services/references');

/**
 * Maps strings in arrays of layoutData into the properties of pageData
 * @param {object} pageData
 * @param {object} layoutData
 * @returns {*}
 */
function mapLayoutToPageData(pageData, site, layoutData) {
  // quickly (and shallowly) go through the layout's properties,
  // finding strings that map to page properties
  _.each(layoutData, function (list, key) {
    if (_.isString(list)) {
      if (_.isArray(pageData[key])) {
        // if you find a match and the data exists,
        // replace the property in the layout data
        layoutData[key] = _.map(pageData[key], (ref) => ({ _ref: uriSwapOutSlug(ref, site) }));
      } else {
        // otherwise replace it with an empty list
        // as all layout properties are component lists
        layoutData[key] = [];
      }
    }
  });

  return layoutData;
}

module.exports = mapLayoutToPageData;
