'use strict';

const es = require('elasticsearch'),
  bluebird = require('bluebird'),
  _ = require('lodash'),
  util = require('util'),
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

function healthCheck(client) {
  client.ping({
    requestTimeout: 1000
  }, function (error) {
    if (error) {
      log('info', 'Elasticsearch cluster is down!');
    } else {
      log('info', 'Elasticsearch cluster is up!');
    }
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
  return client.indices.delete({
    index: index
  }).then(function () {
    log('info', 'Successfully deleted ' + index);
  })
    .catch(function (error) {
      log('error', error);
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
  })
    .catch(function (error) {
      log('error', error);
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
 * @param {string} indexName
 * @param {string} typeName
 * @param {object} body
 * @returns {Promise}
 */
function ensureIndexMappingExists(indexName, typeName, body) {
  log('info', 'looking for mapping at', indexName, typeName);
  return client.indices.getMapping({index: indexName, type: typeName}).then(function (mapping) {
    var foundMapping = _.get(mapping, indexName + '.mappings.' + typeName);

    if (!_.size(foundMapping)) {
      log('info', 'mapping missing at', indexName, typeName, 'from', util.inspect(mapping, {showHidden: true, depth: 10}), foundMapping);
      return client.indices.putMapping({ index: indexName, type: typeName, body: body }).then(function (result) {
        log('info', 'creating mapping', indexName, typeName, ':', result);
      }).catch(function (error) {
        log('error', error.stack);
      });
    } else {
      log('info', 'mapping found at', indexName, typeName);
    }
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
  return existsMapping(index, type)
    .then(function (result) {
      let getMapping = _.get(result, index + '.mappings.' + type);

      if (!_.size(getMapping)) {
        log('info', 'Mapping is missing!');
        return initMapping(index, type, mapping)
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
        return initIndex(index)
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
  return existsAlias(index)
    .then(function (exists) {
      if (!exists) {
        // Indices should have a different name than the alias
        // Append '_v1' to newly created indices
        return initAlias(index, createIndexName(index))
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
  })
    .catch(function (error) {
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
  })
    .catch(function (error) {
      log('error', error);
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
    let str;

    if (resp && resp.errors === true) {
      str = ['Client.bulk errored on ' + util.inspect(ops, {depth: 10})];

      throw new Error(str);
    }
  });
}

module.exports = client;
module.exports.endpoint = endpoint;
module.exports.healthCheck = healthCheck;
module.exports.initIndex = initIndex;
module.exports.delIndex = delIndex;
module.exports.createIndexIfNone = createIndexIfNone;
module.exports.createAliasIfNone = createAliasIfNone;
module.exports.existsAlias = existsAlias;
module.exports.initMapping = initMapping;
module.exports.existsMapping = existsMapping;
module.exports.createMappingIfNone = createMappingIfNone;
module.exports.createIndexName = createIndexName;
module.exports.convertRedisBatchtoElasticBatch = convertRedisBatchtoElasticBatch;
module.exports.del = del;
module.exports.batch = batch;
module.exports.put = put;
module.exports.query = query;