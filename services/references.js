'use strict';

/**
 * All of these function get or set from a reference path.
 *
 * That is, each call is literally `someMethod(referencePath);`
 *
 * @module
 */

var config = require('config'),
  _ = require('lodash'),
  db = require('./db'),
  schema = require('./schema'),
  files = require('./files'),
  path = require('path'),
  glob = require('glob'),
  bluebird = require('bluebird'),
  is = require('./assert-is'),
  log = require('./log'),
  uid = require('./uid');

/**
 * Consistent way to get page data by reference.  Validation of page can go here.
 * @param {string} ref
 * @returns {Promise.object}
 */
function getPageData(ref) {
  return db.get(ref).then(JSON.parse);
}

/**
 * Consistent way to put page data.  Validation of page can go here.
 * @param ref
 * @param data
 * @returns {Promise.object}
 */
function putPageData(ref, data) {
  return db.put(ref, JSON.stringify(data)).return(data);
}

/**
 * Consistent way to get uri data.  Validation of URI can go here.
 * @param {string} ref
 * @returns {Promise.string}
 */
function getUriData(ref) {
  return db.get(ref);
}

/**
 * Consistent way to put uri data.  Validation of URI can go here.
 * @param {string} ref
 * @param {string} data
 * @returns {Promise.string}
 */
function putUriData(ref, data) {
  return db.put(ref, data).return(data);
}



module.exports.getUriData = getUriData;
module.exports.putUriData = putUriData;
module.exports.getPageData = getPageData;
module.exports.putPageData = putPageData;
