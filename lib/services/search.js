'use strict';

const _ = require('lodash'),
  es = require('elasticsearch'),
  bluebird = require('bluebird');

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

module.exports = client;
module.exports.endpoint = endpoint;