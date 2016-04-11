'use strict';

const _ = require('lodash'),
  bluebird = require('bluebird'),
  components = require('./components'),
  references = require('./references'),
  referenceProperty = '_ref';

/**
 * Find all _ref, and recursively expand them.
 *
 * @param {object} data
 * @param {object} locals  Extra data that some GETs use
 * @param {function|string} [filter='_ref']
 * @returns {Promise}
 */
function resolveComponentReferences(data, locals, filter) {
  const referenceObjects = references.listDeepObjects(data, filter || referenceProperty);

  return bluebird.all(referenceObjects).each(function (referenceObject) {
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
  }).return(data);
}
module.exports.resolveComponentReferences = resolveComponentReferences;
