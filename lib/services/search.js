'use strict';

const _ = require('lodash'),
  es = require('elasticsearch'),
  bluebird = require('bluebird'),
  log = require('./log').withStandardPrefix(__filename);

_.mixin(require('lodash-ny-util'));

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
 * @param {string} index name
 * @returns {index}
 */
function initIndex(index) {
  return client.indices.create({
    index: index
  });
}

/**
 * Delete an Elasticsearch index
 *
 * @param {string} index name
 * @returns {index}
 */
function delIndex(index) {
  return client.indices.delete({
    index: index
  });
}

module.exports = client;
module.exports.endpoint = endpoint;
module.exports.initIndex = initIndex;
module.exports.delIndex = delIndex;