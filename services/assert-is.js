/**
 * Control of the error messages that we produce from assertion-like code.
 *
 * @module
 */

'use strict';

var _ = require('lodash');

function expectedType(obj, typeName, ref) {
  var str = 'Expected ' + typeName + ', not ' + (typeof obj);

  if (ref) {
    str += ' for ' + ref;
  }

  throw new Error(str);
}

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
  return thing;
}

/**
 * Duck-typing.
 *
 * @param obj
 * @param [ref]
 */
function isPromise(obj, ref) {
  if (!_.isObject(obj) || !_.isFunction(obj.then)) {
    expectedType(obj, 'promise', ref);
  }
  return obj;
}

function isObject(obj, ref) {
  if (!_.isObject(obj)) {
    expectedType(obj, 'object', ref);
  }
  return obj;
}

function isString(obj, ref) {
  if (!_.isString(obj)) {
    expectedType(obj, 'string', ref);
  }
  return obj;
}

module.exports = exists;
module.exports.promise = isPromise;
module.exports.object = isObject;
module.exports.string = isString;