/**
 * Controller for Users
 *
 * @module
 */

'use strict';

const _ = require('lodash'),
  bluebird = require('bluebird'),
  db = require('./db'),
  buf = require('./buffer'),
  sites = require('./sites');

/**
 * Validate a data object for specific values. Throw
 * an error if a value is undefined.
 *
 * @param  {String} username
 * @param  {String} provider
 * @param  {String} auth
 */
function validateUserObject({ username, provider, auth }) {
  if (!username || !provider || !auth) {
    throw new Error('Users require username, provider and auth to be specified!');
  }
}

/**
 * Return a Promise for performing a put or delete of data
 * to a specific user instance for all sites in a single
 * Clay implementation.
 *
 * @param  {String} userId
 * @param  {Object} data
 * @param  {Function} data
 * @return {Array}
 */
function constructSitesPromise(userId, data, fn) {
  return _.map(sites.sites(), site => {
    let userUri = `${site.host}${site.path}/users/${userId}`;

    return fn(userUri, data);
  });
}

/**
 * Put user information to the DB
 *
 * @param  {String} userUri
 * @param  {Object} data
 * @return {Promise}
 */
function putUserData(userUri, data) {
  return db.put(userUri, JSON.stringify(data)).then(function () {
    data._ref = userUri;
    return data;
  })
  .catch(e => {
    return { error: e, _ref: userUri };
  });
}

/**
 * Delete a user's data
 *
 * @param  {String} userUri
 * @return {Promise}
 */
function deleteUserData(userUri) {
  return db.get(userUri)
    .then(JSON.parse)
    .then(oldData => db.del(userUri).return(oldData));
}
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
 * @param {string} uri
 * @param {object} data
 * @returns {Promise}
 */
function post(uri, data) {
  validateUserObject(data);

  uri = templateUserId(uri, username, provider);

  return db.put(uri, JSON.stringify(data)).then(function () {
    data._ref = uri;
    return data;
  });
}

/**
 * Create a uri for a user. Checks if there's a trailing slash on the
 * uri and prunes it before constructing, just for safety. base64
 * encodes the user id.
 *
 * @param  {String} uri
 * @param  {String} username
 * @param  {String} provider
 * @return {String}
 */
function templateUserId(uri, username, provider) {
  return `${uri}${uri.slice(-1) === '/' ? '' : '/'}${encode(username.toLowerCase(), provider)}`;
}

/**
 * Creates new user instances instances across all sites
 *
 * @param  {String} uri
 * @param  {Object} data
 * @return {Promise}
 */
function postAll(uri, data) {
  let userId;

  // Validate data object
  validateUserObject(data);
  // Construct the userId once
  userId = templateUserId('', username, provider);
  // Return the resolved promises for user creation
  return bluebird.all(constructSitesPromise(userId, data, putUserData));
}

/**
 * Modifies user object at a specific ID across all sites
 *
 * @param  {String} uri
 * @param  {Object} data
 * @return {Promise}
 */
function putAll(uri, data) {
  let userId;

  // Validate data object
  validateUserObject(data);
  // Grab userID
  userId = uri.split('/all-sites/')[1];
  // Return the resolved promises for user modification
  return bluebird.all(constructSitesPromise(userId, data, putUserData));
}

/**
 * Delete a user instance across all sites
 *
 * @param  {String} uri
 * @return {Promise}
 */
function deleteAll(uri) {
  return bluebird.all(constructSitesPromise(uri.split('/all-sites/')[1], null, deleteUserData));
}

// outsiders can act on users
module.exports.post = post;
module.exports.postAll = postAll;
module.exports.putAll = putAll;
module.exports.deleteAll = deleteAll;
module.exports.encode = encode;
module.exports.decode = buf.decode;
