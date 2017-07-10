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
 * @param {string} uri
 * @param {object} data
 * @returns {Promise}
 */
function post(uri, data) {
  let username = data.username,
    provider = data.provider;

  if (!username || !provider) {
    throw new Error('Users require username and provider to be specified!');
  }

  uri += '/' + encode(username.toLowerCase(), provider);

  return db.put(uri, JSON.stringify(data)).then(function () {
    data._ref = uri;
    return data;
  });
}

// outsiders can act on users
module.exports.post = post;
module.exports.encode = encode;
module.exports.decode = decode;
