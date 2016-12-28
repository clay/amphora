'use strict';

const elastic = require('elasticsearch'),
  bluebird = require('bluebird'),
  _ = require('lodash'),
  elasticHelpers = require('../elastic/helpers'),
  files = require('../files'),
  moduleExists = require('../utils/module-exists'),
  path = require('path'),
  util = require('util'),
  log = require('./log').withStandardPrefix(__filename),
  endpoint = process.env.ELASTIC_HOST || '',
  serverConfig = {
    host: endpoint,
    maxSockets: 500,
    apiVersion: '2.3',
    // log: ['error', 'trace'],
    defer: require('../utils/defer')
  },
  searchDir = '/search';

// Reference to the ES client
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
 * Append '_v1' to an index name.
 *
 * @param {string} alias
 * @returns {string}
 */
function createIndexName(alias) {
  return alias + '_v1';
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
 * Query an Elasticsearch index
 *
 * @param {string} index
 * @param {string} query
 * @param {string} type
 * @param {int} limit
 * @returns {Promise}
 */
function query(index, query, type, limit) {
  return client.search({
    index: index,
    type: type,
    size: limit,
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
 * Create the ES Client or set the client to the overrideClient
 * @param  {Object} [overrideClient]
 * @return {Promise}
 */
function createClient(overrideClient) {
  return new bluebird(function (resolve, reject) {
    if (!module.exports.endpoint && !overrideClient) {
      reject(new Error('No Elastic endpoint or client override'));
    }

    // Set the exported client
    module.exports.client = client = module.exports.endpoint && !overrideClient ? new elastic.Client(_.clone(serverConfig)) : _.assign(module.exports.client, overrideClient);

    resolve(client);
  });
}

/**
 * Setup the client and check the health of the client. Override
 * client is an optional argument which will replace the regular
 * ES client. This is used for testing, but in production
 * `overrideClient` will be undefined.
 *
 * @param {Object} [overrideClient]
 * @return {Promise}
 */
function setup(overrideClient) {
  // Create client + check the connection
  return createClient(overrideClient)
    .then(healthCheck)
    // .then(createInternalIndices)
    .then(setupMappings)
    .catch(function (err) {
      return bluebird.reject(err);
    });
}

/**
 * Check if the correct indices exist, and if they don't, create them.
 *
 * @param {Object} mappings
 * @returns {Promise}
 */
function validateIndices(mappings) {
  return bluebird.all(_.map(Object.keys(mappings), function (index) {
    return module.exports.createIndexIfNone(createIndexName(index)).then(function () {
      return module.exports.createAliasIfNone(index);
    });
  }))
  .then(function () {
    return bluebird.all(_.reduce(mappings, function (list, types, index) {
      return list.concat(_.map(types, function (mapping, type) {
        return module.exports.createMappingIfNone(createIndexName(index), type, mapping);
      }));
    }, []));
  });
}

/**
 * Load the mappings from the mappings folder.
 *
 * The name of the file becomes the name of the index (convention over configuration).
 *
 * @param {string} dirPath
* @param {string} prefix
 * @returns {object}
 */
function retrieveMappingData(dirPath, prefix) {
  var list = files.getFiles(dirPath),
    mappings = {};

  _.each(list, function (filename) {
    const mappingName = filename.split('.')[0],
      mappingIndex = prefix + mappingName,
      mapping = files.getYaml(path.join(dirPath, mappingName));

    mappings[mappingIndex] = mapping;
  });

  return mappings;
}

// /**
//  * Create indices that are required for Clay
//  *
//  * @return {Promise}
//  */
// function createInternalIndices() {
//   var dirPath = path.resolve(__dirname, '../elastic/mappings'),
//     internalMappings = retrieveMappingData(dirPath);
//
//   return validateIndices(internalMappings)
//     .then(require(process.cwd() + searchDir))
//     .then(function () {
//       // Listen to events internally
//       db.on('batch', pageList.updatePageList(internalMappings));
//       return bluebird.resolve();
//     });
// }

/**
 * If a directory with search data exists, instantiate it.
 * If not, don't do anything.
 *
 * @param {String} overrideDir
 * @return {Promise}
 */
function setupMappings(overrideDir) {
  var externalSearch = moduleExists(process.cwd() + (overrideDir || searchDir));

  if (externalSearch) {
    return externalSearch();
  }

  return bluebird.resolve();
}

/**
 * Return current instance of the search client. Also
 * available via the `module.exports.client`.
 *
 * @return {object}
 */
function getInstance() {
  return module.exports.client;
}

module.exports.setup = setup;
module.exports.endpoint = endpoint;
module.exports.healthCheck = healthCheck;
module.exports.initIndex = initIndex;
module.exports.initAlias = initAlias;
module.exports.createIndexIfNone = createIndexIfNone;
module.exports.createAliasIfNone = createAliasIfNone;
module.exports.existsAlias = existsAlias;
module.exports.existsIndex = existsIndex;
module.exports.initMapping = initMapping;
module.exports.existsMapping = existsMapping;
module.exports.createMappingIfNone = createMappingIfNone;
module.exports.del = del;
module.exports.batch = batch;
module.exports.put = put;
module.exports.query = query;
module.exports.retrieveMappingData = retrieveMappingData;
module.exports.validateIndices = validateIndices;

// Filters for Elastic ops
module.exports.filters = require('../elastic/db-filters');
// Elastic Helpers
module.exports.convertRedisBatchtoElasticBatch = elasticHelpers.convertRedisBatchtoElasticBatch;
module.exports.normalizeOpValuesWithMapping = elasticHelpers.normalizeOpValuesWithMapping;
module.exports.parseOpValue = elasticHelpers.parseOpValue;
module.exports.applyOpFilters = elasticHelpers.applyOpFilters;
module.exports.removeAllReferences = elasticHelpers.removeAllReferences;
module.exports.getInstance = getInstance;

// Exported for testing
module.exports.createIndexName = createIndexName;
module.exports.createClient = createClient;
module.exports.setupMappings = setupMappings;
