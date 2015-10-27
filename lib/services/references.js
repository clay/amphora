'use strict';

var _ = require('lodash'),
  propagatingVersions = ['published', 'latest'];

function setPropagatingVersions(value) {
  propagatingVersions = value;
}

function getPropagatingVersions() {
  return propagatingVersions;
}

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
 * @returns {Function}
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



module.exports.replaceVersion = replaceVersion;
module.exports.replaceAllVersions = replaceAllVersions;
module.exports.setPropagatingVersions = setPropagatingVersions;
module.exports.getPropagatingVersions = getPropagatingVersions;
module.exports.isPropagatingVersion = isPropagatingVersion;
