'use strict';

const _ = require('lodash'),
  files = require('./files'),
  path = require('path');

function findVariations(styleguide) {
  const stylePath = `styleguides/${styleguide}/components`,
    stylesheets = files.getFiles(stylePath),
    variations = _.filter(stylesheets, function (file) {
      // checks for underscores which denotes variations and make sure it's a
      // css file
      return file.includes('_') && file.includes('.css');
    });

  return variations;
}

function getVariations(styleguide) {
  const foundVariations = styleguide ? findVariations(styleguide) : [],
    componentVariations = {};

  if (foundVariations.length !== 0) {
    _.forEach(foundVariations, function (variant) {
      let component = variant.split('_')[0],
        variantName = path.basename(variant);

      if (!componentVariations[component]) {
        componentVariations[component] = [variantName];
      } else {
        componentVariations[component].push(variantName);
      }
    });

    return componentVariations;
  }
}

exports.getVariations = _.memoize(getVariations);
