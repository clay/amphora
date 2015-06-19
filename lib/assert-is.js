/**
 * Control of the error messages that we produce from assertion-like code.
 *
 * @module
 */

'use strict';

var _ = require('lodash');

/**
 * Remove all references to ourselves, lodash, and bluebird
 * @param error
 * @returns {*}
 */
function removeSelfReferences(error) {
  error.stack = _.filter(error.stack.split('\n'), function (line) {
    return line.indexOf('assert-is') === -1 && line.indexOf('lodash') === -1 && line.indexOf('bluebird') === -1;
  }).join('\n');
  return error;
}

function throwMissingError(thingName, ref) {
  var str = 'Missing ' + thingName;

  if (ref) {
    str += ' for ' + ref;
  }

  throw removeSelfReferences(new Error(str));
}

function throwExpectedTypeError(obj, typeName, ref) {
  var str = 'Expected ' + typeName + ', not ' + (typeof obj);

  if (ref) {
    str += ' for ' + ref;
  }

  throw removeSelfReferences(new Error(str));
}

/**
 *
 * @param thing
 * @param thingName
 * @param [ref]
 */
function exists(thing, thingName, ref) {
  if (!thing) {
    throwMissingError(thingName, ref);
  }
  return thing;
}

/**
 * @param obj
 * @param [ref]
 * @returns {*}
 */
function isObject(obj, ref) {
  if (!_.isObject(obj)) {
    throwExpectedTypeError(obj, 'object', ref);
  }
  return obj;
}

module.exports = exists;
module.exports.object = isObject;