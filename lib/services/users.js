/**
 * Controller for Users
 *
 * @module
 */

'use strict';

const db = require('./db');

function encode(username, provider) {
  return new Buffer(`${username}@${provider}`).toString('base64');
}

function decode(string) {
  return new Buffer(string, 'base64').toString('utf8');
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
