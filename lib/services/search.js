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
  })
    .catch(function (error) {
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
        return initAlias(name, index + '_v1')
          .then(function (result) {
            log('info', 'Creating Elasticsearch alias', name, ':', result);
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


module.exports = client;
module.exports.endpoint = endpoint;
module.exports.initIndex = initIndex;
module.exports.delIndex = delIndex;
module.exports.createIndexIfNone = createIndexIfNone;
module.exports.createAliasIfNone = createAliasIfNone;
module.exports.del = del;
module.exports.put = put;
module.exports.query = query;