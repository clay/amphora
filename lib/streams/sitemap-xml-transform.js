/**
 * Transforms chunks of strings or objects into JSON-parseable text
 *
 * @module
 */

'use strict';

var util = require('util'),
  Transform = require('stream').Transform;

function SitemapXmlTransform() {
  // allow use without new
  if (!(this instanceof SitemapXmlTransform)) {
    return new SitemapXmlTransform();
  }

  // init Transform
  Transform.call(this, {objectMode: true});
}
util.inherits(SitemapXmlTransform, Transform);
SitemapXmlTransform.prototype._transform = function (item, enc, cb) {
  var url, error;

  try {
    url = JSON.parse(item.value).url;
  } catch (ex) {
    error = ex;
  }

  if (error) {
    this.emit('error', error);
  } else if (url) {
    this.push(url + '\n');
  }
  cb();
};
SitemapXmlTransform.prototype._flush = function (cb) {
  cb();
};

module.exports = SitemapXmlTransform;