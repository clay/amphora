'use strict';

const elastic = require('elasticsearch'),
  bluebird = require('bluebird'),
  _ = require('lodash'),
  util = require('util'),
  log = require('./log').withStandardPrefix(__filename),
  endpoint = process.env.ELASTIC_HOST || '',
  serverConfig = {
    host: endpoint,
    maxSockets: 500,
    apiVersion: '1.7',
    // log: ['error', 'trace'],
    defer: require('../utils/defer')
  };

var client,
  indexVersion = '_v1';

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
  return client.indices.create({
    index: index,
    body: mappings
  }).then(function () {
    log('info', 'Successfully created ' + index);
  })
    .catch(function (error) {
      log('error', error);
      return bluebird.reject(error);
    });
}

/**
 * Check if an Elasticsearch index exists
 *
 * @param {string} index
 * @returns {Promise}
 */
function existsIndex(index) {
  return client.indices.exists({
    index: index
  });
}

/**
 * Indices should have a different name than the alias
 * Append the `indexVersion` to an index name.
 *
 * @param {string} alias
 * @returns {string}
 */
function createIndexName(alias) {
  return alias + indexVersion;
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
  return client.indices.putAlias({
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
  return client.indices.existsAlias({
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
  return client.indices.putMapping({
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
  return client.indices.getMapping({
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
        // Append `aliaSuffix` to newly created indices
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
  return client.search({
    index: index,
    type: type,
    body: query
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
  return client.index({
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
  return client.delete({
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
  return client.bulk({
    body: ops
  }).then(function (resp) {
    if (resp && resp.errors === true) {
      let str = ['Client.bulk errored on ' + util.inspect(ops, {depth: 10})];

      return bluebird.reject(new Error(str));
    }
  });
}

/**
 * Create the ES Client or an empty object
 *
 * @param {Object} overrideClient
 */
function setup(overrideClient) {
  if (!module.exports.endpoint && !overrideClient) {
    throw new Error('No Elastic endpoint or client override');
  }

  // Set the exported client
  module.exports.client = client = module.exports.endpoint && !overrideClient ? new elastic.Client(serverConfig) : _.assign(module.exports.client, overrideClient);
}

/**
 * Sets the index version. Index version is required
 * to begin with '_v' to denote a version of the index.
 *
 * @param {string} suffix
 */
function setIndexVersion(suffix) {
  if (_.isString(suffix) && _.includes(suffix, '_v')) {
    indexVersion = suffix;
  } else {
    throw new Error('Index version required to be a string beginning with "_v"');
  }
}

module.exports.setup = setup;
module.exports.setIndexVersion = setIndexVersion;
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
