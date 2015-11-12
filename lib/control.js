'use strict';

var _ = require('lodash');

/**
 * @param {*} obj
 * @returns {boolean}
 */
function isFreezable(obj) {
  var type = typeof obj;

  // NOTE: leave functions allow, despite object-like behavior.  We need them for stubs.
  return type === 'object' && obj !== null && Object.isFrozen && !Object.isFrozen(obj);
}

/**
 * Set object to read-only (in-place)
 *
 * @param {*} obj
 * @returns {*}
 */
function setReadOnly(obj) {
  if (isFreezable(obj)) {
    _.forOwn(obj, function (value) {
      if (typeof value === 'object' && value !== null) {
        //console.log('setReadOnly', value);
        setReadOnly(value);
      }
    });

    Object.freeze(obj);
  }
  return obj;
}

/**
 * Apply only to properties of thing, first-level of object will remain editable
 * @param {*} obj
 */
function setDeepObjectTypesReadOnly(obj) {
  _.each(obj, function (value) {
    setReadOnly(value);
  });
}

module.exports.setReadOnly = setReadOnly;
module.exports.setDeepObjectTypesReadOnly = setDeepObjectTypesReadOnly;
