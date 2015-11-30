'use strict';

var _ = require('lodash'),
  urlParse = require('url'),
  propagatingVersions = ['published', 'latest'];

/**
 * @param {[string]} value
 */
function setPropagatingVersions(value) {
  propagatingVersions = value;
}

/**
 * @returns {[string]}
 */
function getPropagatingVersions() {
  return propagatingVersions;
}

/**
 * @param {string} uri
 * @param {string} [version]
 * @returns {string}
 */
function replaceVersion(uri, version) {
  if (version) {
    uri = uri.split('@')[0] + '@' + version;
  } else {
    // no version is still a kind of version
    uri = uri.split('@')[0];
  }

  return uri;
}

/**
 * @param {string} version
 * @returns {function}
 */
function replaceAllVersions(version) {
  return function (data) {
    _.each(_.listDeepObjects(data, '_ref'), function (obj) {
      obj._ref = replaceVersion(obj._ref, version);
    });
    return data;
  };
}

/**
 * Some versions should propagate throughout the rest of the data.
 * @param {string} uri
 */
function isPropagatingVersion(uri) {
  var version = uri.split('@')[1];

  return !!version && _.contains(propagatingVersions, version);
}

/**
 * @param {string} url
 * @returns {boolean}
 */
function isUrl(url) {
  const parts = _.isString(url) && urlParse.parse(url);

  return !!parts && !!parts.protocol && !!parts.hostname && !!parts.path;
}

/**
 * @param {string} uri
 * @returns {boolean}
 */
function isUri(uri) {
  return _.isString(uri) && uri.indexOf(':') === -1;
}

module.exports.replaceVersion = replaceVersion;
module.exports.replaceAllVersions = replaceAllVersions;
module.exports.setPropagatingVersions = setPropagatingVersions;
module.exports.getPropagatingVersions = getPropagatingVersions;
module.exports.isPropagatingVersion = isPropagatingVersion;
module.exports.isUrl = isUrl;
module.exports.isUri = isUri;
