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
 * @param uri , the version must follow @, will throw if null passed
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
 * Return the type of the component and the site if any like article or paragraph
 * @param uri in the format ...<site>/components/<component_name>/instances/...  <site> is optional, will throw if null passed
 * @returns {object} {component: component_name, site: site} , if no site, site field is not returned; returns null if uri format not respected
 */
function extractSiteAndComponent(uri){
  //First remove :// from the uri to simplify
  uri = uri.replace('://', '');
  var groups = /\/(.+\/)?components\/(.+)\/instances/.exec(uri);
  if (groups && groups.length > 2) {
    var res = {
      component: groups[2]
    };
    if (groups[1]) {
      //sitename is optional
      res.site = groups[1].replace('/', '');
    }
    return res;
  } else {
    return null;
  }
}

module.exports.replaceVersion = replaceVersion;
module.exports.replaceAllVersions = replaceAllVersions;
module.exports.setPropagatingVersions = setPropagatingVersions;
module.exports.isPropagatingVersion = isPropagatingVersion;
module.exports.extractVersion = extractVersion;
module.exports.extractSiteAndComponent = extractSiteAndComponent;