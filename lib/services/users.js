/**
 * Controller for Users
 *
 * @module
 */

'use strict';

const db = require('./db'),
  buf = require('./buffer');

/**
 * encode username and provider to base64
 * @param {string} username
 * @param {string} provider
 * @returns {string}
 */
function encode(username, provider) {
  return buf.encode(`${username}@${provider}`);
}

/**
 * decode username and provider from base64
 * @param {string} string
 * @returns {string} username@provider
 */
function decode(string) {
  return buf.decode(string);
}

/**
 * @param {object} data
 * @returns {Promise}
 */
function createUser(data) {
  let { username, provider, auth } = data,
    uri = '/_users/';

  console.log(data);

  // Validate payload
  if (!username || !provider || !auth) {
    throw new Error('Users require username, provider and auth to be specified!');
  }

  // Add the encoded username and provider to the end of the uri
  uri += encode(username.toLowerCase(), provider);

  // Save to the DB
  return db.put(uri, JSON.stringify(data)).then(function () {
    data._ref = uri;
    return data;
  });
}

// outsiders can act on users
module.exports.createUser = createUser;
module.exports.encode = encode;
module.exports.decode = decode;
