'use strict';

const _ = require('lodash');

/**
 * @param {*} obj
 * @returns {boolean}
 */
function isFreezable(obj) {
  const type = typeof obj;

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
        setReadOnly(value);
      }
    });

    Object.freeze(obj);
  }
  return obj;
}

function defineReadOnly(definition) {
  if (!definition.get) {
    definition.writable = false;
  }
  definition.enumerable = false;
  definition.configurable = false;
  delete definition.set;
  return definition;
}

function defineWritable(definition) {
  if (!definition.set && !definition.get) {
    definition.writable = true;
  }
  definition.enumerable = false;
  definition.configurable = false;
  return definition;
}

module.exports.setReadOnly = setReadOnly;
module.exports.defineReadOnly = defineReadOnly;
module.exports.defineWritable = defineWritable;
