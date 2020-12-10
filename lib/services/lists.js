'use strict';

const _isEqual = require('lodash/isEqual'),
  db = require('./db');

/**
 * Appends an entry to a list and returns the updated list.
 * @param {string} uri
 * @param {Array<Object>|Object} data
 * @returns {Array<Object>}
 */
async function addToList(uri, data) {
  // do a db call for the list
  const list = await db.get(uri),
    added = list.concat(data);

  // concat with new data, save, and return full list
  // db.put wraps result in an object `{ _value: list }`, return list only
  return db.put(uri, added).then(() => added);
}

/**
 * Removes an entry from a list and returns the updated list.
 * @param {string} uri
 * @param {Object} data
 * @returns {Array<Object>}
 */
async function removeFromList(uri, data) {
  // do a db call for the list
  let list = await db.get(uri),
    removed = list.filter(entry => !_isEqual(entry, data));

  if (list.length === removed.legnth) {
    throw new Error('Nothing was removed from the list.');
  }

  // db.put wraps result in an object `{ _value: list }`, return list only
  return db.put(uri, removed).then(() => removed);
}

module.exports.addToList = addToList;
module.exports.removeFromList = removeFromList;
