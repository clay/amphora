/**
 * Transforms chunks of strings or objects into JSON-parseable text
 *
 * @module
 */

'use strict';

const util = require('util'),
  Transform = require('stream').Transform;

/* eslint-disable complexity */
function JSONTransform(options) {
  // allow use without new
  if (!(this instanceof JSONTransform)) {
    return new JSONTransform(options);
  }

  this.isFirst = true;

  if (options.objectMode !== true) {
    // assume that if they're not giving us objects, this will be an array of strings
    this.isArray = true;
  } else {
    // otherwise they either tell us, or we're assuming they want the smallest form of this data, which is an object.
    this.isArray = options.isArray || false;
  }

  this.options = options;
  this.keyProperty = options.keyProperty || 'key';
  this.valueProperty = options.valueProperty || 'value';

  // init Transform
  Transform.call(this, options);
}
util.inherits(JSONTransform, Transform);
JSONTransform.prototype._transform = function (chunk, enc, cb) {
  let item, error,
    isArray = this.isArray,
    objectMode = this.options.objectMode;

  if (!objectMode && isArray) {
    // if not an object, assume an array of strings.
    item = '"' + chunk.toString() + '"';
  } else if (objectMode && isArray) {
    // if objects and array, concat the chunks
    item = JSON.stringify(chunk);
  } else if (objectMode && !isArray) {
    // if objects and not an array, give it in object format (not array)
    item = '"' + chunk[this.keyProperty] + '":' + JSON.stringify(chunk[this.valueProperty]);
  } else {
    error = new Error('Unknown option configuration');
  }

  if (this.isFirst) {
    // only the first time
    this.isFirst = false;
    if (isArray) {
      item = '[' + item;
    } else {
      item = '{' + item;
    }
  } else {
    item = ',' + item;
  }

  if (error) {
    this.emit('error', error);
  } else {
    this.push(item);
  }
  cb();
};
JSONTransform.prototype._flush = function (cb) {
  if (this.isArray) {
    if (this.isFirst) {
      this.push('[');
    }
    this.push(']');
  } else {
    if (this.isFirst) {
      this.push('{');
    }
    this.push('}');
  }
  cb();
};

module.exports = JSONTransform;
