'use strict';

var _ = require('lodash'),
  propagatingVersions = ['published', 'latest'];

function setPropagatingVersions(value) {
  propagatingVersions = value;
}

function replaceVersion(ref, version) {
  if (version) {
    ref = ref.split('@')[0] + '@' + version;
  } else {
    // no version is still a kind of version
    ref = ref.split('@')[0];
  }

  return ref;
}

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
 * @param {string} ref
 * @returns {boolean}
 */
function isPropagatingVersion(ref) {
  var version = ref.split('@')[1];

  return version && _.contains(propagatingVersions, version);
}

module.exports.replaceVersion = replaceVersion;
module.exports.replaceAllVersions = replaceAllVersions;
module.exports.setPropagatingVersions = setPropagatingVersions;
module.exports.isPropagatingVersion = isPropagatingVersion;
