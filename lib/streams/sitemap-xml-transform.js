/**
 * Transforms chunks of strings or objects into JSON-parseable text
 *
 * @module
 */

'use strict';

const _ = require('lodash'),
  bluebird = require('bluebird'),
  db = require('../services/db'),
  references = require('../services/references'),
  siteService = require('../services/sites'),
  util = require('util'),
  Transform = require('stream').Transform;

function getChangeFrequencyXML(value) {
  if (value) {
    value = '<changefreq>' + value + '</changefreq>';
  }
  return value || '';
}

function getLastModifiedXML(value) {
  if (value) {
    if (_.isNumber(value)) {
      value = new Date(value).toISOString();
    }
    value = '<lastmod>' + value + '</lastmod>';
  }
  return value || '';
}


function getPriorityXML(value) {
  if (value) {
    value = '<priority>' + value + '</priority>';
  }
  return value || '';
}

function getUrlXML(value) {
  const url = '<loc>' + value.url + '</loc>',
    lastModified = getLastModifiedXML(value.lastModified),
    changeFrequency = getChangeFrequencyXML(value.changeFrequency),
    priority = getPriorityXML(value.priority);

  return '<url>' + url + lastModified + changeFrequency + priority + '</url>';
}

function assertPublicUriPointsToPage(pageUri, publicUri) {
  return function (uriData) {
    if (uriData !== pageUri) {
      throw new Error(pageUri + ' has a url that does not match the associated ' + publicUri + ', which is ' + uriData);
    }
  };
}

function SitemapXmlTransform() {
  // allow use without new
  if (!(this instanceof SitemapXmlTransform)) {
    return new SitemapXmlTransform();
  }

  this.isFirst = true;

  // init Transform
  Transform.call(this, {objectMode: true});
}
util.inherits(SitemapXmlTransform, Transform);
SitemapXmlTransform.prototype._transform = function (item, enc, cb) {
  var value, prefix, publicUri, xml, error;
  const stream = this,
    pageUri = item.key,
    sitePrefix = references.getPagePrefix(pageUri),
    site = siteService.getSiteFromPrefix(prefix);

  bluebird.try(function () {
    value = JSON.parse(item.value);
    publicUri = sitePrefix + '/uris/' + new Buffer(references.urlToUri(value.url)).toString('base64');
    xml = getUrlXML(value);

    // verify /uris/<uri of page> exists

    return db.get(publicUri);
  })
    .then(assertPublicUriPointsToPage)
    .then(function () {
      if (this.isFirst) {
        value =
          '<?xml version="1.0" encoding="UTF-8"?>' +
          '<urlset ' +
          'xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" ' +
          'xsi:schemaLocation="http://www.sitemaps.org/schemas/sitemap/0.9 http://www.sitemaps.org/schemas/sitemap/0.9/sitemap.xsd" ' +
          'xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" ' +
          'xmlns:image="http://www.google.com/schemas/sitemap-image/1.1" ' +
          'xmlns:video="http://www.google.com/schemas/sitemap-video/1.1">' + value;
        stream.isFirst = false;
      }

      // if page data has areas, check each area for a component with a sitemap.*

      stream.push(value);
    })
    // url is not public, do not include in sitemap
    .catch({name: 'NotFoundError'}, _.noop)
    // some unexpected error occurred
    .catch(function (error) {
      stream.emit('error', error);
    }).finally(cb);
};
SitemapXmlTransform.prototype._flush = function (cb) {
  this.push('</urlset>');
  cb();
};

module.exports = SitemapXmlTransform;