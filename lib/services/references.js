'use strict';

const _ = require('lodash'),
  urlParse = require('url'),
  { replaceVersion } = require('clayutils');
let propagatingVersions = ['published', 'latest'];

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
 * @param {object} obj
 * @param {Function} [filter=_.identity]  Optional filter
 * @returns {array}
 */
function listDeepObjects(obj, filter) {
  let cursor, items,
    list = [],
    queue = [obj];

  while (queue.length) {
    cursor = queue.pop();
    items = _.filter(cursor, _.isObject);
    list = list.concat(_.filter(items, filter || _.identity));
    queue = queue.concat(items);
  }

  return list;
}

/**
 * @param {string} version
 * @returns {function}
 */
function replaceAllVersions(version) {
  return function (data) {
    _.each(listDeepObjects(data, '_ref'), function (obj) {
      obj._ref = replaceVersion(obj._ref, version);
    });
    return data;
  };
}

/**
 * Some versions should propagate throughout the rest of the data.
 * @param {string} uri
 * @returns {boolean}
 */
function isPropagatingVersion(uri) {
  const version = uri.split('@')[1];

  return !!version && _.includes(propagatingVersions, version);
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


/**
 * Take the protocol and port from a sourceUrl and apply them to some uri
 * @param {string} uri
 * @param {string} [protocol]
 * @param {string} [port]
 * @returns {string}
 */
function uriToUrl(uri, protocol, port) {
  // just pretend to start with http; it's overwritten two lines down
  const parts = urlParse.parse('http://' + uri);

  parts.protocol = protocol || 'http';
  parts.port = port || process.env.PORT;
  delete parts.host;

  if (parts.port &&
    (parts.protocol === 'http' && parts.port.toString() === '80') ||
    parts.protocol === 'https' && parts.port.toString() === '443'
  ) {
    delete parts.port;
  }

  return parts.format();
}

/**
 * Remove protocol and port
 * @param {string} url
 * @returns {string}
 */
function urlToUri(url) {
  let parts;

  if (!isUrl(url)) {
    throw new Error('Invalid url ' + url);
  }
  parts = urlParse.parse(url);

  return `${parts.hostname}${decodeURIComponent(parts.path)}`;
}


/**
 * Remove the configuration properties of a page, leaving only page-level references
 * @param {object} pageData
 * @returns {object}
 */
function omitPageConfiguration(pageData) {
  return _.omit(pageData, ['_dynamic', 'layout', 'url', 'urlHistory', 'customUrl', 'lastModified', 'priority', 'changeFrequency']);
}

/**
 * Returns the list of all page-level references in page data, removing layout, url, etc.
 *
 * @param {object} pageData
 * @returns {[string]}
 */
function getPageReferences(pageData) {
  return _.flatten(_.values(omitPageConfiguration(pageData)));
}

module.exports.replaceVersion = replaceVersion;
module.exports.replaceAllVersions = replaceAllVersions;
module.exports.setPropagatingVersions = setPropagatingVersions;
module.exports.getPropagatingVersions = getPropagatingVersions;
module.exports.isPropagatingVersion = isPropagatingVersion;
module.exports.isUrl = isUrl;
module.exports.isUri = isUri;
module.exports.uriToUrl = uriToUrl;
module.exports.urlToUri = urlToUri;
module.exports.omitPageConfiguration = omitPageConfiguration;
module.exports.getPageReferences = getPageReferences;
module.exports.listDeepObjects = listDeepObjects;
