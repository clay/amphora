/**
 * Transforms chunks of strings or objects into JSON-parseable text
 *
 * @module
 */

'use strict';

var _ = require('lodash'),
  util = require('util'),
  Transform = require('stream').Transform;

function PublishedFilter() {
  // allow use without new
  if (!(this instanceof PublishedFilter)) {
    return new PublishedFilter();
  }

  // init Transform
  Transform.call(this, {objectMode: true});
}
util.inherits(PublishedFilter, Transform);
PublishedFilter.prototype._transform = function (item, enc, cb) {
  if (_.endsWith(item.key, '@published')) {
    this.push(item);
  }
  cb();
};
PublishedFilter.prototype._flush = function (cb) {
  cb();
};

module.exports = PublishedFilter;