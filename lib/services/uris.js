'use strict';

const _ = require('lodash'),
  buf = require('./buffer'),
  references = require('./references'),
  { getPrefix } = require('clayutils'),
  notifications = require('./notifications'),
  siteService = require('./sites'),
  bus = require('./bus'),
  meta = require('./metadata');
var db = require('./db');

/**
 * @param {string} uri
 * @param {string} body
 * @returns {Promise}
 */
function put(uri, body) {
  if (uri === body) {
    throw new Error('Client: Cannot point uri at itself');
  }

  if (_.includes(body, '"') || _.includes(body, '\'')) {
    throw new Error('Client: Destination cannot contain quotes');
  }

  if (references.isPropagatingVersion(body)) {
    throw new Error('Client: Cannot point uri at propagating version, such as @published');
  }

  return db.put(uri, body).then(() => body);
}

/**
 * Deletes a URI
 *
 * NOTE: Return the data it used to contain.  This is often used to create queues or messaging on the client-side,
 * because clients can guarantee that only one client was allowed to be the last one to fetch a particular item.
 *
 * @param {string} uri
 * @param {object} user
 * @param {object} locals
 * @returns {Promise}
 */
function del(uri, user, locals) {
  const callHooks = _.get(locals, 'hooks') !== 'false';

  return db.get(uri).then(oldPageUri => {
    return db.del(uri).then(() => {
      const prefix = getPrefix(uri),
        site = siteService.getSiteFromPrefix(prefix),
        pageUrl = buf.decode(uri.split('/').pop());

      if (!callHooks) {
        return Promise.resolve(oldPageUri);
      }

      bus.publish('unpublishPage', { uri: oldPageUri, url: pageUrl, user });
      notifications.notify(site, 'unpublished', { url: pageUrl, uri: oldPageUri });
      return meta.unpublishPage(oldPageUri, user)
        .then(() => oldPageUri);
    });
  });
}

module.exports.put = put;
module.exports.del = del;

// For testing
module.exports.setDb = mock => db = mock;
