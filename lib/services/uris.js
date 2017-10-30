'use strict';

const _ = require('lodash'),
  buf = require('./buffer'),
  db = require('./db'),
  references = require('./references'),
  notifications = require('./notifications'),
  plugins = require('../plugins');

/**
 * @param {String} uri
 * @param {Object} site
 * @returns {Promise}
 */
function get(uri, site) {
  return db.get(references.uriSwapInSlug(uri, site))
    .then(page => references.uriSwapOutSlug(page, site));
}

/**
 * @param {String} uri
 * @param {String} body
 * @param {Object} site
 * @returns {Promise}
 */
function put(uri, body, site) {
  if (uri === body) {
    throw new Error('Client: Cannot point uri at itself');
  }

  if (_.includes(body, '"') || _.includes(body, '\'')) {
    throw new Error('Client: Destination cannot contain quotes');
  }

  if (references.isPropagatingVersion(body)) {
    throw new Error('Client: Cannot point uri at propagating version, such as @published');
  }

  return db.put(
    references.uriSwapInSlug(uri, site),
    references.uriSwapInSlug(body, site)
  ).return(body);
}

/**
 * Deletes a URI
 *
 * NOTE: Return the data it used to contain.  This is often used to create queues or messaging on the client-side,
 * because clients can guarantee that only one client was allowed to be the last one to fetch a particular item.
 *
 * @param {String} uri
 * @param {Object} site
 * @returns {Promise}
 */
function del(uri, site) {
  return get(uri, site).then(function (oldData) {
    return db.del(references.uriSwapInSlug(uri, site)).then(function () {
      const pageUrl = buf.decode(uri.split('/').pop());

      // Call the unpublish hook for plugins
      plugins.executeHook('unpublish', {
        url: pageUrl,
        uri: oldData
      });


      notifications.notify(site, 'unpublished', { url: pageUrl });
    }).return(oldData);
  });
}

module.exports.get = get;
module.exports.put = put;
module.exports.del = del;
