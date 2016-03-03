/**
 * Transforms chunks of strings or objects into JSON-parseable text
 *
 * @module
 */

'use strict';

const log = require('../log').withStandardPrefix(__filename),
  util = require('util'),
  Transform = require('stream').Transform;

function SitemapTextTransform() {
  // allow use without new
  if (!(this instanceof SitemapTextTransform)) {
    return new SitemapTextTransform();
  }

  // init Transform
  Transform.call(this, {objectMode: true});
}
util.inherits(SitemapTextTransform, Transform);
SitemapTextTransform.prototype._transform = function (item, enc, cb) {
  try {
    this.push(JSON.parse(item.value).url + '\n');
  } catch (ex) {
    // eat errors, because pipes otherwise 'unpipe' the parent stream and stop streaming.
    log('warn', 'SitemapTextTransform', ex.message);
  }
  cb();
};
SitemapTextTransform.prototype._flush = function (cb) {
  cb();
};

module.exports = SitemapTextTransform;