'use strict';

const MongoClient = require('mongodb').MongoClient,
  DB_NAME = 'clay',
  MONGO_URL = 'mongodb://localhost:27017',
  COLLECTIONS = ['components', 'pages', 'uris', 'lists', 'users', 'schedule'],
  escapeStringRegexp = require('escape-string-regexp'),
  h = require('highland'),
  { isComponent, isPage, isList, isUser } = require('clayutils');
var log = require('./logger').setup({ file: __filename });

function isUri(uri) {
  return uri.indexOf('/_uris/') > -1;
}

function connect() {
  // Use connect method to connect to the server
  MongoClient.connect(MONGO_URL, (err, client) => {
    if (err) return log('fatal', 'Error connecting to Mongo server', {server: MONGO_URL});
    log('info', 'Connected successfully to Mongo server', {server: MONGO_URL});

    module.exports.db = client.db(DB_NAME);

    for (let i = 0; i < COLLECTIONS.length; i++) {
      let col = COLLECTIONS[i];

      createCollection(col);
      module.exports[`${col}Collection`] = module.exports.db.collection(col);
    }
  });
}

function createCollection(name) {
  // http://mongodb.github.io/node-mongodb-native/3.0/api/Db.html#createCollection
  return module.exports.db.createCollection(name);
}

function hackyCollectionFind(prefix) {
  if (prefix === '/_users/') {
    return 'usersCollection';
  } else if (prefix.indexOf('/instances') > -1) {
    return 'componentsCollection';
  }

  return `${prefix.match(/\/_(.+)$/)[1]}Collection`;
}

function createReadStream(options) {
  var query = {_id: {$regex: escapeStringRegexp(options.prefix)}},
    cursor = module.exports[`${hackyCollectionFind(options.prefix)}`].find(query),
    stream = h();

  cursor.on('data', doc => {
    stream.write(doc._id);
  });

  cursor.on('end', () => {
    stream.write(h.nil);
  });

  return stream;
}

function insert(collection, key, value) {
  value._id = key;

  return module.exports[collection].insertOne(value, { w: 'majority' });
}

function insertMany(collection, ops) {
  return module.exports[collection].insertMany(ops, { w: 'majority' });
}

function updateMany(collection, _id, value) {
  return module.exports[collection].updateOne({ _id }, { $set: value }, { upsert: true });
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

module.exports.insert = insert;
module.exports.insertMany = insertMany;

// TODO: rename the one below to something better
module.exports.updateMany = updateMany;
module.exports.createReadStream = createReadStream;

module.exports.update = update;
module.exports.insertList = insertList;
module.exports.getByKey = getByKey;
