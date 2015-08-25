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

class UriParser {
  /**
   uri in the format ...<prefix>/components/<component_name>/instances/...@...
  */
  constructor(uri) {
    this.uri = uri;
    //First remove :// from the uri to simplify
    this.groups = /\/(.+\/)?components\/(.+)\/instances/.exec(uri.replace('://', ''));
  }

  /**
   * returns the version -uid, published-
   */
  version() {
    var atIndex = this.uri.indexOf('@');
    if (atIndex > 0) {
      return this.uri.substr(atIndex + 1);
    } else {
      return null;
    }
  }

  /**
   * returns the prefix or null
   */
  prefix() {
    if (this.groups && this.groups.length > 1 && this.groups[1]) {
      return this.groups[1].replace('/', '');
    } else {
      return null;
    }
  }

  /**
    * returns the component name
   */
  component() {
    if (this.groups && this.groups.length > 2 && this.groups[2]) {
      return this.groups[2];
    } else {
      return null;
    }
  }
}

module.exports.replaceVersion = replaceVersion;
module.exports.replaceAllVersions = replaceAllVersions;
module.exports.setPropagatingVersions = setPropagatingVersions;
module.exports.isPropagatingVersion = isPropagatingVersion;
module.exports.UriParser = UriParser;
