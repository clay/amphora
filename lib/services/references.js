'use strict';

const _ = require('lodash'),
  { replaceVersion } = require('clayutils'),
  // url.parse() percent-encoded these characters after the host. WHATWG URL
  // encodes a different set, so parseUrl() escapes these itself.
  LEGACY_ESCAPED = /[\t\n\r "'<>\\^`{|}]/g,
  // url.parse() gave urls with these protocols a / path when they had a host
  // and no path
  SLASHED_PROTOCOLS = ['http:', 'https:', 'ftp:', 'gopher:', 'file:', 'ws:', 'wss:'];
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
  let cursor, items, matched, i;
  const list = [],
    queue = [obj];

  while (queue.length) {
    cursor = queue.pop();
    items = _.filter(cursor, _.isObject);
    matched = _.filter(items, filter || _.identity);

    // Push in place. concat copied both arrays on every pass, which made
    // large pages quadratic. The order is the same as with concat.
    for (i = 0; i < matched.length; i++) {
      list.push(matched[i]);
    }
    for (i = 0; i < items.length; i++) {
      queue.push(items[i]);
    }
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
 * @param {string} char
 * @returns {string}
 */
function percentEncode(char) {
  return '%' + char.charCodeAt(0).toString(16).toUpperCase().padStart(2, '0');
}

/**
 * @param {string} protocol  lower case, with its colon
 * @param {string} host  everything between // and the path, port included
 * @returns {string|null} null when WHATWG URL rejects the host, and for javascript:
 */
function getHostname(protocol, host) {
  let hostname;

  // url.parse() never gave a javascript: url a host, so isUrl() stays false
  // for one and a page can't be published at it
  if (protocol === 'javascript:') {
    return null;
  }

  try {
    // url.parse() read the host the same way whatever the protocol, so parse
    // it as http. For a protocol URL doesn't know it would keep the host as
    // written (no lower case or punycode), and for file: it would drop
    // localhost and reject a port or a user name.
    // URL trims control characters off the end of its input; the slash keeps
    // them in the host, so a host with one is rejected like other invalid hosts
    hostname = new URL(`http://${host}/`).hostname;
  } catch (e) {
    return null;
  }

  // url.parse() gave IPv6 addresses without their brackets
  return hostname[0] === '[' ? hostname.slice(1, -1) : hostname;
}

/**
 * Parse an absolute url without url.parse(), which Node 24 deprecates (DEP0169).
 *
 * The uris amphora stores and the urls it renders were made with url.parse(),
 * so the results have to stay the same. WHATWG URL checks the host and gives
 * the hostname (lower case, punycode). The path, query and hash are cut from
 * the url itself and escaped the way url.parse() escaped them, because URL
 * would encode them differently: it leaves ' and | alone, encodes non-ASCII
 * characters and resolves ../ segments.
 *
 * @param {string} url
 * @returns {object|null} protocol, hostname, pathname, search, hash and path
 *   (pathname and search), like url.parse(). null when the url isn't a string
 *   that starts with protocol://. hostname is null when the host isn't valid
 *   and for javascript: urls.
 */
function parseUrl(url) {
  let str, queryStart, match, protocol, hostname, rest, pathname, search;

  if (!_.isString(url)) {
    return null;
  }

  // url.parse() trimmed whitespace and turned backslashes before the query into slashes
  str = url.replace(/^[\x00-\x20\xa0\ufeff]+|[\x00-\x20\xa0\ufeff]+$/g, '');
  queryStart = str.search(/[?#]|$/);
  str = str.slice(0, queryStart).replace(/\\/g, '/') + str.slice(queryStart);
  match = /^([a-z][a-z\d+.-]*:)\/\/([^/?#]*)([^]*)$/i.exec(str);

  if (!match) {
    return null;
  }

  protocol = match[1].toLowerCase();
  hostname = getHostname(protocol, match[2]);
  rest = /^([^?#]*)(\?[^#]*)?(#[^]*)?$/.exec(match[3].replace(LEGACY_ESCAPED, percentEncode));
  pathname = rest[1] || (hostname && _.includes(SLASHED_PROTOCOLS, protocol) ? '/' : '');
  search = rest[2] || '';

  return {
    protocol,
    hostname,
    pathname,
    search,
    hash: rest[3] || '',
    path: pathname + search
  };
}

/**
 * @param {string} url
 * @returns {boolean}
 */
function isUrl(url) {
  const parts = parseUrl(url);

  return !!parts && !!parts.hostname && !!parts.path;
}

/**
 * @param {string} uri
 * @returns {boolean}
 */
function isUri(uri) {
  return _.isString(uri) && uri.indexOf(':') === -1;
}


/**
 * @param {string} protocol
 * @param {string|number} port
 * @returns {boolean}
 */
function isDefaultPort(protocol, port) {
  return protocol === 'http' && port.toString() === '80' ||
    protocol === 'https' && port.toString() === '443';
}

/**
 * Take the protocol and port from a sourceUrl and apply them to some uri
 * @param {string} uri
 * @param {string} [protocol]
 * @param {string} [port]
 * @returns {string}
 */
function uriToUrl(uri, protocol, port) {
  // just pretend to start with http; only the host and path are used
  const parts = parseUrl('http://' + uri);
  let host;

  if (!parts.hostname) {
    throw new Error('Invalid uri ' + uri);
  }

  protocol = protocol || 'http';
  port = port || process.env.PORT;

  // only drop the port when it is the default for the protocol
  if (port && isDefaultPort(protocol, port)) {
    port = null;
  }

  // IPv6 addresses get their brackets back
  host = _.includes(parts.hostname, ':') ? `[${parts.hostname}]` : parts.hostname;

  // url.format() took the protocol with or without its colon
  return `${_.trimEnd(protocol, ':')}://${host}${port ? ':' + port : ''}${parts.path}${parts.hash}`;
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
  parts = parseUrl(url);

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
module.exports.parseUrl = parseUrl;
module.exports.isUrl = isUrl;
module.exports.isUri = isUri;
module.exports.uriToUrl = uriToUrl;
module.exports.urlToUri = urlToUri;
module.exports.omitPageConfiguration = omitPageConfiguration;
module.exports.getPageReferences = getPageReferences;
module.exports.listDeepObjects = listDeepObjects;
