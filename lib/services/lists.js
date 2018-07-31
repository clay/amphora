'use strict';

var db = require('./db');

/**
 *
 * @param {*} uri
 * @param {*} data
 */
function putItem(uri, data) {
  return db.put(uri, data);
}

/**
 *
 */
function getAllLists() {
  return db.getLists();
}

/**
 *
 * @param {*} uri
 * @param {*} data
 */
function put(uri, data) {
  if (Array.isArray(data)) {
    return Promise.all(data.map(item => {
      return putItem(`${uri}/${item.id}`, item);
    }));
  } else {
    return putItem(uri, data);
  }
}

module.exports.put = put;
module.exports.getAllLists = getAllLists;

// For testing
module.exports.setDb = mock => db = mock;