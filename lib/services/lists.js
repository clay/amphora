'use strict';

const db = require('./db');

function putItem(uri, data) {
  return db.put(uri, data);
}

function getAllLists() {
  return db.getLists();
}

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