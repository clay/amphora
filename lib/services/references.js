'use strict';

var _ = require('lodash');

function replaceVersion(ref, version) {
  if (version) {
    ref = ref.split('@')[0] + '@' + version;
  } else {
    //no version is still a kind of version
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

module.exports.replaceVersion = replaceVersion;
module.exports.replaceAllVersions = replaceAllVersions;