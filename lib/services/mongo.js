'use strict';

const MongoClient = require('mongodb').MongoClient,
  DB_NAME = 'clay',
  MONGO_URL = 'mongodb://localhost:27017',
  h = require('highland'),
  { isComponent, isPage, isList, isUser, getComponentName } = require('clayutils');

function isUri(uri) {
  return uri.indexOf('/_uris/') > -1;
}

function createCollection(name) {
  // http://mongodb.github.io/node-mongodb-native/3.0/api/Db.html#createCollection
  module.exports.db.createCollection(name);
}

function connect() {
  // Use connect method to connect to the server
  MongoClient.connect(MONGO_URL, (err, client) => {
    if (err) console.log(err);
    console.log('Connected successfully to server');

    module.exports.db = client.db(DB_NAME);
    module.exports.componentsCollection = module.exports.db.collection('components');
    module.exports.pagesCollection = module.exports.db.collection('pages');
    module.exports.urisCollection = module.exports.db.collection('uris');
    module.exports.listsCollection = module.exports.db.collection('lists');
    module.exports.usersCollection = module.exports.db.collection('users');
  });
}


function insert(collection, key, value) {
  value._id = key;

  return module.exports[collection].insertOne(value, { w: 'majority' });
}

function insertMany(collection, ops) {
  return module.exports[collection].insertMany(ops, { w: 'majority' });
}

function update(_id, value) {
  if (isList(_id)) {
    return insertList(_id, value);
  } else if (isUri(_id)) {
    return insertUri(_id, value);
  }

  value = JSON.parse(value);
  value._id = _id;

  return module.exports[`${findCollection(_id)}`].updateOne({ _id }, { $set: value }, { upsert: true });
}

function insertUri(_id, value) {
  let docValue = { _id, value };

  return module.exports.urisCollection.updateOne({ _id }, { $set: docValue }, { upsert: true });
}

function insertList(key, value) {
  return module.exports.listsCollection.updateOne({ _id: key }, { $set: { value } }, { upsert: true });
}

function findCollection(uri) {
  if (isComponent(uri)) {
    return 'componentsCollection';
  } else if (isUri(uri)) {
    return 'urisCollection';
  } else if (isPage(uri)) {
    return 'pagesCollection';
  } else if (isList(uri)) {
    return 'listsCollection';
  } else if (isUser(uri)) {
    return 'usersCollection';
  }
}

function getByKey(_id) {
  // TODO: Stringified expectation
  return Promise.resolve(module.exports[`${findCollection(_id)}`].findOne({ _id })).then(JSON.stringify);
}

module.exports = connect;
module.exports.db = undefined;
module.exports.componentsCollection = undefined;
module.exports.pagesCollection      = undefined;
module.exports.urisCollection       = undefined;
module.exports.listsCollection      = undefined;
module.exports.usersCollection      = undefined;

module.exports.insert = insert;
module.exports.insertMany = insertMany;
module.exports.update = update;
module.exports.insertList = insertList;

// module.exports.batch = batch;
// module.exports.save = save;
module.exports.getByKey = getByKey;
module.exports.createCollection = createCollection;
