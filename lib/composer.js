'use strict';

const _ = require('lodash'),
  bluebird = require('bluebird'),
  components = require('./services/components'),
  referenceProperty = '_ref';

/**
 * Find all _ref, and recursively expand them.
 *
 * @param {object} data
 * @param {function|string} [filter='_ref']
 * @returns {Promise}
 */
function resolveComponentReferences(data, filter) {
  var referenceObjects = _.listDeepObjects(data, filter || referenceProperty);

  return bluebird.all(referenceObjects).each(function (referenceObject) {
    return components.get(referenceObject[referenceProperty]).then(function (obj) {
      // the thing we got back might have its own references
      return resolveComponentReferences(obj, filter).finally(function () {
        _.assign(referenceObject, _.omit(obj, referenceProperty));
      });
    });
  }).return(data);
}

module.exports.resolveComponentReferences = resolveComponentReferences;