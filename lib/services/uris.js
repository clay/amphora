'use strict';

const db = require('./db'),
  references = require('./references'),
  notifications = require('./notifications'),
  siteService = require('./sites');

/**
 * Get the prefix like 'some-domain.com/some-path/uris/some-uri' into 'some-domain.com/some-path'.
 *
 * @param {string} uri
 * @returns {string}
 */
function getPrefix(uri) {
  return uri.substr(0, uri.indexOf('/uris/'));
}

/**
 * @param {string} uri
 * @returns {Promise}
 */
function get(uri) {
  return db.get(uri);
}

/**
 * @param {string} uri
 * @param {string} body
 * @returns {Promise}
 */
function put(uri, body) {
  if (uri === body) {
    throw new Error('Client: Cannot point uri at itself');
  }

  if (references.isPropagatingVersion(body)) {
    throw new Error('Client: Cannot point uri at propagating version, such as @published');
  }

  return db.put(uri, body).return(body);
}

/**
 * Deletes a URI
 *
 * NOTE: Return the data it used to contain.  This is often used to create queues or messaging on the client-side,
 * because clients can guarantee that only one client was allowed to be the last one to fetch a particular item.
 *
 * @param {string} uri
 * @param {object} locals
 * @returns {Promise}
 */
function del(uri, locals) {
  return get(uri, locals).then(function (oldData) {
    return db.del(uri).then(function () {
      const prefix = getPrefix(uri),
        site = siteService.getSiteFromPrefix(prefix);

      notifications.notify(site, 'unpublished', oldData);
    }).return(oldData);
  });
}

module.exports.get = get;
module.exports.put = put;
module.exports.del = del;
