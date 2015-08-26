'use strict';
var _ = require('lodash'),
  bluebird = require('bluebird'),
  UriParser = require('./uriparser'),
  searchEngine;

/**
 * Apply f when search engine is defined
 * @param {function} f
 * @returns {Promise} returns return value of f, undefined otherwise
 */
function withSearchEngine(f) {
  if (searchEngine) {
    return f();
  } else {
    return bluebird.resolve();
  }
}


/**
 * @param {string} index
 * @param {string} type
 * @param {string} id
 * @returns {Promise} returning value or error -error name has to be NotFoundError-
 */
function get(index, type, id) {
  return withSearchEngine(function () {
    return searchEngine.get(index, type, id);
  });
}

/**
 * @param {string} index
 * @param {string} type
 * @param {string} id
 * @param {object} doc
 * @returns {Promise}
 */
function put(index, type, id, doc) {
  return withSearchEngine(function () {
    return searchEngine.put(index, type, id, doc);
  });
}

/**
 * @param {string} id
 * @returns {Promise}
 */
function del(index, type, id) {
  return withSearchEngine(function () {
    return searchEngine.del(index, type, id);
  });
}

/**
 * Only indexes components with valid uri
 * @param {string} id the uri of the component instance
 * @returns {{}} {index:..., type: ...} -> search engine index name and type name
 */
function getSearchIndex(id) {
  const parser = new UriParser(id),
  component = parser.component(),
  prefix = parser.prefix();
  var indexPrefix = (prefix) ? prefix + '-' : '',
  op = {};
  op.type = (parser.version() === 'published') ? 'published' : 'draft';
  if (component) {
    //We prefix we amphora
    op.index = 'amphora-' + indexPrefix + component;
  }
  return op;
}

/**
 *
 * @param {array} indices List of indices to search in
 * @param {array} types List of types to search in
 * @param {object} query Specific to the DSL used by your search engine
 * @param {object} searchOpts Supports:
 *  limit: default to 10
 *  skip:  default to 0
 *  sort:  default to search_score, else when sorting by a specific field or anything else
 *         , scoring is ignored and only filtering matters. Filtering is implemented
 *         in the adapter, so the searchEngine does not have to send custom dsl for filtering only
 *  include: specify list of fields to return in response, default to all
 *  exclude: specify list of fields to exclude in response, default to none
 *
 * @returns {Promise} wrapping {items:[], total:254}
 */
function search(indices, types, query, searchOpts) {
  return withSearchEngine(function () {
    return searchEngine.search(indices, types, query, searchOpts);
  });
}

/**
 * Delete indices
 * @param {array} indices An array of indices names or * for all
 * @returns {Promise}
 */
function deleteIndices(indices) {
  return withSearchEngine(function () {
    return searchEngine.deleteIndices(indices);
  });
}

/**
 * @param {array} {[{index:index, type:type, command:put, id:id, doc:doc}]} searchBulkOps
 *  type is in put, del
 *  doc is omitted when del
 *  doc is expected to be complete doc, not partial and an object, not a stringified json obj
 * @returns {Promise}
 */
function searchBulk(searchBulkOps) {
  return withSearchEngine(function () {
    return searchEngine.searchBulk(searchBulkOps);
  });
}

/**
 * Filter out operations which do not have a search index
 * @param {array} ops a list of batch operations
 * @returns {array} Array of filtered operations, augmented with serach index and type
*/
function mapSearchBatchOps(ops) {
  var searchOps = _.cloneDeep(ops);
  return _.filter(searchOps, function (op) {
    var fullIndex = getSearchIndex(op.key);
    op.index = fullIndex.index;
    op.indexType = fullIndex.type;
    return fullIndex.index;
  });
}

/**
 * Batch operations in the search engine
 * @param {array} ops batch input expected by db.js
 * @returns {Promise}
 */
function batch(ops) {
  return withSearchEngine(function () {
    const searchOps = _.map(mapSearchBatchOps(ops), function (op) {
      return {
        index: op.index,
        type: op.indexType,
        doc: JSON.parse(op.value),
        id: op.key,
        command: op.type
      };
    });
    return searchBulk(searchOps);
  });
}

/**
 * Returns a boolean in a promise testing index existence
 * @param {string} name
 * @returns {Promise}
 */
function hasIndex(name) {
  return withSearchEngine(function () {
    return searchEngine.hasIndex(name);
  });
}

/**
 * Create an index with the given name. Errors out if index already exists
 * @param {string}name the name of the index
 * @param {doc} body the object to specify the index settings -specific to the search engine-
 * @returns {Promise}
 */
function createIndex(name, settings) {
  return withSearchEngine(function () {
    return searchEngine.createIndex(name, settings);
  });
}

function setSearchEngine(searchModule) {
  //Should contain at least the contract api
  const apiFcts = ['put', 'get', 'del', 'search', 'deleteIndices', 'searchBulk', 'hasIndex', 'createIndex'];
  var validated = _.every(apiFcts, function (it) {
    return _.includes(_.keys(searchModule), it);
  });
  //No search module means reset to empty behavior
  if (searchModule && !validated) {
    throw new Error('Search engine does not respect interface contract: ' + apiFcts + '; You supplied: ' + _.keys(searchModule));
  } else {
    searchEngine = searchModule;
  }
}

/**
 * Only executes a command like put or delete operation on a valid index, otherwise just return empty promise
 * @param {string} uri of a component instance
 * @param {function} op the operation to be performed in the form function(index, type){your put or delete op code}
 * @returns {*} A promise or undefined
 */
function tryExecuteCommand(uri, op) {
  var fullIndex = getSearchIndex(uri);
  if (fullIndex.index) {
    return op(fullIndex.index, fullIndex.type);
  }
}

/**
* Only executes a delete operation on a valid index infered from uri, otherwise just return undefined
* @param {string} uri of a component instance
* @returns {*} A promise or undefined
*/
function delByUri(uri) {
  return tryExecuteCommand(uri, function (index, type) {
    return del(index, type, uri);
  });
}

/**
* Only executes a put operation on a valid index infered from uri, otherwise just return undefined
* @param {string} uri of a component instance
* @param {object} doc the doc value
* @returns {*} A promise or undefined
*/
function putByUri(uri, doc) {
  return tryExecCmd(uri, function (index, type) {
    return put(index, type, uri, doc);
  });
}

module.exports.get = get;
module.exports.put = put;
module.exports.putByUri = putByUri;
module.exports.del = del;
module.exports.delByUri = delByUri;
module.exports.createIndex = createIndex;
module.exports.deleteIndices = deleteIndices;
module.exports.hasIndex = hasIndex;
module.exports.getSearchIndex = getSearchIndex;
module.exports.batch = batch;
module.exports.search = search;
module.exports.searchBulk = searchBulk;
module.exports.setSearchEngine = setSearchEngine;
