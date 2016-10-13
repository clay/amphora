/**
 * Controller for Users
 *
 * @module
 */

'use strict';

const db = require('./db'),
  uid = require('../uid');

/**
 * @param {string} uri
 * @param {object} data
 * @returns {Promise}
 */
function post(uri, data) {
  uri += '/' + uid.get();

  return db.put(uri, JSON.stringify(data)).then(function () {
    data._ref = uri;
    return data;
  });
}

// outsiders can act on users
module.exports.post = post;
