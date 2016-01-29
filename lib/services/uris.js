'use strict';

const _ = require('lodash'),
  db = require('./db'),
  references = require('./references'),
  notifications = require('./notifications'),
  siteService = require('./sites');

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

  if (_.contains(body, '"') || _.contains(body, '\'')) {
    throw new Error('Client: Destination cannot contain quotes');
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
      const prefix = references.getUriPrefix(uri),
        site = siteService.getSiteFromPrefix(prefix);

      notifications.notify(site, 'unpublished', oldData);
    }).return(oldData);
  });
}

module.exports.get = get;
module.exports.put = put;
module.exports.del = del;
