'use strict';

const es = require('elasticsearch'),
  bluebird = require('bluebird'),
  log = require('./log').withStandardPrefix(__filename);

let endpoint = process.env.ELASTIC_HOST,
  serverConfig = {
    host: endpoint,
    maxSockets: 500,
    apiVersion: '1.7',
    // log: ['error', 'trace'],
    defer: function () {
      return bluebird.defer();
    }
  },
  client = new es.Client(serverConfig);

client.ping({
  requestTimeout: 1000
}, function (error) {
  if (error) {
    log('info', 'Elasticsearch cluster is down!');
  } else {
    log('info', 'Elasticsearch cluster is up!');
  }
});

/**
 * Create an Elasticsearch index
 *
 * @param {string} index
  * @param {object} mappings
 * @returns {Promise}
 */
function initIndex(index, mappings) {
  return client.indices.create({
    index: index,
    body: mappings
  }).then(function () {
    log('info', 'Successfully created ' + index);
  }, function (error) {
    log('error', error);
  });
}

/**
 * Delete an Elasticsearch index
 *
 * @param {string} index
 * @returns {Promise}
 */
function delIndex(index) {
  return client.indices.delete({
    index: index
  }).then(function () {
    log('info', 'Successfully deleted ' + index);
  }, function (error) {
    log('error', error);
  });
}

/**
 * Query an Elasticsearch index
 *
 * @param {string} index
 * @param {string} query
 * @returns {Promise}
 */
function query(index, query) {
  return client.search({
    index: index,
    type: type,
    body: query
  }).then(function (resp) {
    console.log(resp);
    let hits = resp.hits.hits;

    console.log(hits);
  }, function (error) {
    log('error', error);
  });
}

/**
 * Index an Elasticsearch document
 *
 * @param {string} index
 * @param {string} type
 * @param {string} ref, e.g. 'localhost.dev.nymag.biz/scienceofus/components/article/instances/section-test'
 * @param {object} source
 * @returns {index}
 */
function put(index, type, ref, source) {
  return client.index({
    index: index,
    type: type,
    id: ref,
    body: source
  }).then(function (resp) {
    log('info', resp);
  }, function (error) {
    log('error', error);
  });
}

/**
 * Delete an Elasticsearch document
 *
 * @param {string} index
 * @param {string} type
 * @param {string} ref, e.g. 'localhost.dev.nymag.biz/scienceofus/components/article/instances/section-test'
 * @returns {index}
 */
function del(index, type, ref) {
  return client.delete({
    index: index,
    type: type,
    id: ref
  }).then(function (resp) {
    log('info', resp);
  }, function (error) {
    log('error', error);
  });
}



module.exports = client;
module.exports.del = del;
module.exports.put = put;
module.exports.query = query;
module.exports.endpoint = endpoint;
module.exports.initIndex = initIndex;
module.exports.delIndex = delIndex;