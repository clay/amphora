/**
 * Transforms chunks of strings or objects into JSON-parseable text
 *
 * @module
 */

'use strict';

const _ = require('lodash'),
  bluebird = require('bluebird'),
  components = require('../services/components'),
  composer = require('../composer'),
  db = require('../services/db'),
  log = require('../log'),
  multiplexTemplates = require('multiplex-templates'),
  references = require('../services/references'),
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

function getUrlXML(value, extra) {
  const url = '<loc>' + value.url + '</loc>',
    lastModified = getLastModifiedXML(value.lastModified),
    changeFrequency = getChangeFrequencyXML(value.changeFrequency),
    priority = getPriorityXML(value.priority);

  return '<url>' + url + lastModified + changeFrequency + priority + extra + '</url>';
}

function assertPublicUriPointsToPage(pageUri, pageData) {
  const sitePrefix = references.getPagePrefix(pageUri),
    publicUri = sitePrefix + '/uris/' + new Buffer(references.urlToUri(pageData.url)).toString('base64');

  return db.get(publicUri).then(function (uriData) {
    if (references.replaceVersion(uriData, 'published') !== pageUri) {
      throw new Error(pageUri + ' has a url that does not match the associated ' + publicUri + ', which is ' + uriData);
    }
  });
}

/**
 * Renders each found component in series (as a list), returns resulting string of xml elements without a root element.
 * @param {string} componentReference
 * @returns {Promise}
 */
function renderXMLComponentsAsList(componentReference) {
  return components.get(componentReference)
    .then(composer.resolveComponentReferences)
    .then(function (resolvedComponentData) {
      const indices = components.getIndices(componentReference, resolvedComponentData);

      return _.map(indices.refs, function (referenceData, reference) {
        const template = components.getTemplate(reference, 'sitemap');

        if (template) {
          return multiplexTemplates.render(template, referenceData).replace(/[\n\r\t]|\s\s/g, '');
        }
      }).join('');
    }).catch(function (ex) {
      log.warn('Encountered error while rendering sitemap for', componentReference, ex.stack);
      return '';
    });
}

function renderPageXML(pageData) {
  return bluebird.all(_.map(references.getPageReferences(pageData), renderXMLComponentsAsList)).then(function (xmlList) {
    return getUrlXML(pageData, xmlList.join(''));
  });
}

function getXMLHeader() {
  return '<?xml version="1.0" encoding="UTF-8"?><urlset ' +
    'xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" ' +
    'xsi:schemaLocation="http://www.sitemaps.org/schemas/sitemap/0.9 http://www.sitemaps.org/schemas/sitemap/0.9/sitemap.xsd" ' +
    'xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" ' +
    'xmlns:image="http://www.google.com/schemas/sitemap-image/1.1" ' +
    'xmlns:video="http://www.google.com/schemas/sitemap-video/1.1">';
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
  const stream = this;

  bluebird.try(function () {
    const pageUri = item.key,
      pageData = JSON.parse(item.value);

    return assertPublicUriPointsToPage(pageUri, pageData).then(function () {
      return renderPageXML(pageData);
    });
  }).then(function (xml) {
    if (stream.isFirst) {
      stream.push(getXMLHeader());
      stream.isFirst = false;
    }
    stream.push(xml);
  }).catch({name: 'NotFoundError'}, function (error) {
    log.warn('NotFoundError', error.stack);
  }).catch(function (error) {
    stream.emit('error', error);
  }).finally(cb);
};
SitemapXmlTransform.prototype._flush = function (cb) {
  this.push('</urlset>');
  cb();
};

module.exports = SitemapXmlTransform;