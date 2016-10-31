'use strict';

const es = require('elasticsearch'),
  bluebird = require('bluebird'),
  _ = require('lodash'),
  util = require('util'),
  log = require('./log').withStandardPrefix(__filename),
  endpoint = process.env.ELASTIC_HOST,
  serverConfig = {
    host: endpoint,
    maxSockets: 500,
    apiVersion: '1.7',
    // log: ['error', 'trace'],
    defer: require('../utils/defer')
  };

// Only return ES client if endpoint is defined. Good for testing.
// Note: set to `var` so that it can be overwritten for testing.
var client;

/**
 * Test whether or not the client is connected
 * to Elastic
 *
 * @param  {object} currentClient
 * @returns {Promise}
 */
function healthCheck(currentClient) {
  return currentClient.ping({
    requestTimeout: 1000
  }).then(function () {
    log('info', 'Elasticsearch cluster is up!');
    return bluebird.resolve();
  }).catch(function (error) {
    log('info', 'Elasticsearch cluster is down!');
    return bluebird.reject(error);
  });
}

/**
 * Create an Elasticsearch index
 *
 * @param {string} index
 * @param {object} mappings
 * @returns {Promise}
 */
function initIndex(index, mappings) {
  return module.exports.indices.create({
    index: index,
    body: mappings
  }).then(function () {
    log('info', 'Successfully created ' + index);
  })
    .catch(function (error) {
      log('error', error);
    });
}

/**
 * Check if an Elasticsearch index exists
 *
 * @param {string} index
 * @returns {Promise}
 */
function existsIndex(index) {
  return module.exports.indices.exists({
    index: index
  });
}

/**
 * Indices should have a different name than the alias
 * Append '_v1' to newly created indices
 * @param {string} alias
 * @returns {string}
 */
function createIndexName(alias) {
  return alias + '_v1';
}

/**
 * Delete an Elasticsearch index
 *
 * @param {string} index
 * @returns {Promise}
 */
function delIndex(index) {
  return module.exports.indices.delete({
    index: index
  }).then(function () {
    log('info', 'Successfully deleted ' + index);
  })
    .catch(function (error) {
      log('error', error);
      return bluebird.reject(error);
    });
}

/**
 * Create an Elasticsearch alias
 *
 * @param {string} name, e.g. 'editable-articles' for the index 'editable-articles_v1'
 * @param {string} index
 * @returns {Promise}
 */
function initAlias(name, index) {
  return module.exports.indices.putAlias({
    name: name,
    index: index
  });
}

/**
 * Check if an Elasticsearch alias exists
 *
 * @param {string} name
 * @returns {Promise}
 */
function existsAlias(name) {
  return module.exports.indices.existsAlias({
    name: name
  });
}

/**
 * Create an Elasticsearch mapping
 *
* @param {string} index
* @param {string} type
* @param {object} mapping
* @returns {Promise}
 */
function initMapping(index, type, mapping) {
  return module.exports.indices.putMapping({
    index: index,
    type: type,
    body: mapping
  }).then(function () {
    log('info', 'Successfully created a mapping for ' + index);
    return bluebird.resolve(index);
  })
    .catch(function (error) {
      log('error', error);
      return bluebird.reject(error);
    });
}

/**
 * Check if an Elasticsearch mapping exists
 * Note: An empty mapping can still exist
 *
 * @param {string} index
  * @param {type} type
 * @returns {Promise}
 */
function existsMapping(index, type) {
  return module.exports.indices.getMapping({
    index: index,
    type: type
  });
}

/**
 * Create an Elasticsearch mapping if one doesn't exist
 *
 * @param {string} index
 * @param {string} type
 * @param {object} mapping
 * @returns {Promise}
 */
function createMappingIfNone(index, type, mapping) {
  return module.exports.existsMapping(index, type)
    .then(function (result) {
      let getMapping = _.get(result, index + '.mappings.' + type);

      if (!_.size(getMapping)) {
        log('info', 'Mapping is missing!');

        return module.exports.initMapping(index, type, mapping)
          .then(function (result) {
            log('info', 'Creating mapping', index, type, ':', result);
          }).catch(function (error) {
            log('error', error.stack);
          });
      } else {
        log('info', 'Mapping found for', index);
      }
    });
}

/**
 * Create an Elasticsearch index if one doesn't exist
 *
 * @param {string} index
 * @returns {Promise}
 */
function createIndexIfNone(index) {
  return existsIndex(index)
    .then(function (exists) {
      if (!exists) {
        return module.exports.initIndex(index)
          .then(function (result) {
            log('info', 'Creating Elasticsearch index', index, ':', result);
          })
          .catch(function (error) {
            log('error', error);
          });
      } else {
        log('info', 'Elasticsearch index exists at', index);
      }
    });
}

/**
 * Create an Elasticsearch alias if one doesn't exist
 *
 * @param {string} index
 * @returns {Promise}
 */
function createAliasIfNone(index) {
  return module.exports.existsAlias(index)
    .then(function (exists) {
      if (!exists) {
        // Indices should have a different name than the alias
        // Append '_v1' to newly created indices
        return module.exports.initAlias(index, createIndexName(index))
          .then(function (result) {
            log('info', 'Creating Elasticsearch alias', index, ':', result);
          })
          .catch(function (error) {
            log('error', error);
          });
      } else {
        log('info', 'Elasticsearch alias exists at', index);
      }
    });
}

/**
 * Convert Redis batch operations to Elasticsearch batch operations
 *
 * @param {string} index
 * @param {string} type
 * @param {Array} ops
 * @returns {Array}
 */
function convertRedisBatchtoElasticBatch(index, type, ops) {
  let bulkOps = [];

  _.each(ops, function (op) {
    if (_.isString(op.value)) {
      throw new TypeError('op.value cannot be string: ' + JSON.stringify(op));
    } else if (op.type === 'put') {
      let indexOp = {_index: index, _type: type};

      // key is optional; if missing, an id will be generated that is unique across all shards
      if (op.key) {
        indexOp._id = op.key;
      }

      bulkOps.push(
        {index: indexOp},
        op.value
      );
    } else {
      log('warn', 'Unhandled batch operation:',  op);
    }
  });
  return bulkOps;
}

/**
 * Query an Elasticsearch index
 *
 * @param {string} index
 * @param {string} query
 * @param {string} type
 * @returns {Promise}
 */
function query(index, query, type) {
  return module.exports.search({
    index: index,
    type: type,
    body: query
  }).then(function (resp) {

    // console.log(resp);
    // let hits = resp.hits.hits;

    // console.log(hits);
  })
    .catch(function (error) {
      log('error', error);
      return bluebird.reject(error);
    });
}


/**
 * Index an Elasticsearch document
 *
 * @param {string} index
 * @param {string} type
 * @param {string} ref, e.g. 'localhost.dev.nymag.biz/scienceofus/components/article/instances/section-test'
 * @param {object} source
 * @returns {Promise}
 */
function put(index, type, ref, source) {
  return module.exports.index({
    index: index,
    type: type,
    id: ref,
    body: source
  }).then(function (resp) {
    log('info', resp);
  })
    .catch(function (error) {
      log('error', error);
      return bluebird.reject(error);
    });
}

/**
 * Delete an Elasticsearch document
 *
 * @param {string} index
 * @param {string} type
 * @param {string} ref, e.g. 'localhost.dev.nymag.biz/scienceofus/components/article/instances/section-test'
 * @returns {Promise}
 */
function del(index, type, ref) {
  return module.exports.delete({
    index: index,
    type: type,
    id: ref
  }).then(function (resp) {
    log('info', resp);
    return resp;
  })
    .catch(function (error) {
      log('error', error);
      return bluebird.reject(error);
    });
}

/**
 * Perform multiple index operations
 *
 * @param {Array} ops
 * @returns {Promise}
 */
function batch(ops) {
  return module.exports.bulk({
    body: ops
  }).then(function (resp) {
    let str;

    if (resp && resp.errors === true) {
      str = ['Client.bulk errored on ' + util.inspect(ops, {depth: 10})];

      return bluebird.reject(new Error(str));
    }
  });
}

/**
 * Create the client but allow the client to be overridden.
 * This is handy for when writing tests.
 *
 * @return {object}
 */
function initClient() {
  client = module.exports.endpoint ? new es.Client(serverConfig) : undefined;
  return client;
}

module.exports = endpoint ? new es.Client(serverConfig) : undefined;
module.exports.endpoint = endpoint;
module.exports.healthCheck = healthCheck;
module.exports.initIndex = initIndex;
module.exports.initAlias = initAlias;
module.exports.delIndex = delIndex;
module.exports.createIndexIfNone = createIndexIfNone;
module.exports.createAliasIfNone = createAliasIfNone;
module.exports.existsAlias = existsAlias;
module.exports.existsIndex = existsIndex;
module.exports.initMapping = initMapping;
module.exports.existsMapping = existsMapping;
module.exports.createMappingIfNone = createMappingIfNone;
module.exports.createIndexName = createIndexName;
module.exports.convertRedisBatchtoElasticBatch = convertRedisBatchtoElasticBatch;
module.exports.del = del;
module.exports.batch = batch;
module.exports.put = put;
module.exports.query = query;

// Required for testing to be able to override default client
module.exports.overrideClient = function (overrideClient) {
  client = overrideClient;
};
