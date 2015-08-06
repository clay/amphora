'use strict';

var _ = require('lodash');

/**
 * @param {*} obj
 * @returns {boolean}
 */
function isFreezable(obj) {
  var type = typeof obj;

  // NOTE: leave functions allow, despite object-like behavior.  We need them for stubs.
  return type === 'object' && obj !== null;
}

/**
 * @param {*} obj
 * @returns {*}
 */
function setReadOnly(obj) {
  if (isFreezable(obj)) {
    _.forOwn(obj, function (value) {
      if (typeof value === 'object' && value !== null) {
        setReadOnly(value);
      }
    });

    if (isFreezable(obj) && Object.isFrozen && !Object.isFrozen(obj)) {
      Object.freeze(obj);
    }
  }
  return obj;
}

/**
 * Apply only to properties of thing.
 * @param {*} obj
 */
function setDeepObjectTypesReadOnly(obj) {
  _.each(obj, function (value) {
    setReadOnly(value);
  });
}

module.exports.setReadOnly = setReadOnly;
module.exports.setDeepObjectTypesReadOnly = setDeepObjectTypesReadOnly;