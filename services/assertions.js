/**
 * Control of the error messages that we produce from assertion-like code.
 *
 * @module
 */

'use strict';

var _ = require('lodash');

/**
 *
 * @param thing
 * @param thingName
 * @param [ref]
 */
function exists(thing, thingName, ref) {
  if (!thing) {
    if (ref) {
      throw new Error('Missing ' + thingName + ' for ' + ref);
    } else {
      throw new Error('Missing ' + thingName);
    }
  }
}

/**
 * Duck-typing.
 *
 * @param obj
 * @param [ref]
 */
function isPromise(obj, ref) {
  if (!_.isObject(obj) || !_.isFunction(obj.then)) {
    if (ref) {
      throw new Error('Expected promise, not ' + (typeof obj) + ' for ' + ref);
    } else {
      throw new Error('Expected promise, not ' + (typeof obj));
    }
  }
}

function isObject(obj, ref) {
  if (!_.isObject(obj)) {
    if (ref) {
      throw new Error('Expected object, not ' + (typeof obj) + ' for ' + ref);
    } else {
      throw new Error('Expected object, not ' + (typeof obj));
    }
  }
}


module.exports.exists = exists;
module.exports.isPromise = isPromise;
module.exports.isObject = isObject;