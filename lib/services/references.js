'use strict';

var _ = require('lodash'),
  propagatingVersions = ['published', 'latest'];

function setPropagatingVersions(value) {
  propagatingVersions = value;
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
  return version && _.contains(propagatingVersions, version);
}

/**
 * Return the version of the uri representing an instance or null if none
 * @param uri , the version must follow @
 * @returns {string} the version -uid, published-
 */
function extractVersion(uri){
  var atIndex = uri.indexOf('@');
  if (atIndex > 0) {
    return uri.substr(atIndex + 1);
  } else {
    return null;
  }
}

/**
 * Return the type of the component like article or paragraph or null if uri format not respected
 * @param uri in the format .../components/<component_name>/instances/...
 * @returns {string} component_name
 */
function extractComponentType(uri){
  var groups = /(components\/)(.*)(\/instances)/.exec(uri);
  if (groups && groups.length > 2) {
    return groups[2]
  } else {
    return null;
  }
}

module.exports.replaceVersion = replaceVersion;
module.exports.replaceAllVersions = replaceAllVersions;
module.exports.setPropagatingVersions = setPropagatingVersions;
module.exports.isPropagatingVersion = isPropagatingVersion;
module.exports.extractVersion = extractVersion;
module.exports.extractComponentType = extractComponentType;