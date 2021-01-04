'use strict';

const _isEqual = require('lodash/isEqual');

let db = require('./db');

/**
 * Appends an entry to a list and returns the updated list.
 * @param {Array<Object>} list
 * @param {Array<Object>} data
 * @returns {Array<Object>}
 */
function addToList(list, data) {
  return list.concat(data);
}

/**
 * Removes an entry from a list and returns the updated list.
 * @param {Array<Object>} list
 * @param {Array<Object>} data
 * @returns {Array<Object>}
 */
function removeFromList(list, data) {
  for (const deletion of data) {
    list = list.filter(entry => !_isEqual(entry, deletion));
  }

  return list;
}

/**
 * Add or Remove an item from a list
 * @param {string} uri
 * @param {Array<Object>} data
 * @returns {Promise}
 */
function patchList(uri, data) {
  if (!Array.isArray(data.add) && !Array.isArray(data.remove)) {
    throw new Error('Bad Request. List PATCH requires `add` or `remove` to be an array.');
  }

  return db.get(uri).then(list => {
    if (Array.isArray(data.add)) {
      list = addToList(list, data.add);
    }

    if (Array.isArray(data.remove)) {
      list = removeFromList(list, data.remove);
    }

    // db.put wraps result in an object `{ _value: list }`, return list only
    // hopefully db.put never does anything to the data bc we're just returning list
    return db.put(uri, list).then(() => list);
  });
}

module.exports.patchList = patchList;

// For testing
module.exports.setDb = mock => db = mock;
