var _ = require('lodash'),
  bluebird = require('bluebird'),
  references = require('./references'),
  mocksearch = require('./adapters/mocksearch');

var client = mocksearch;

/**
 * Transforms a str into a json obj
 *  * @param val, a json str or a primitive type
 * @returns {object} If val is not an obj or an array, then returns {value: val}
 */
function toJson (val) {
  const firstChar = val.charAt(0);
  if (firstChar !== '[' && firstChar !== '{') {
    return {value: val};
  } else {
    return JSON.parse(val);
  }
}

module.exports = {
  /**
   * @param {string} index
   * @param {string} type
   * @param {string} id
   * @returns {Promise} returning value or error -error name has to be NotFoundError-
   */
  get: function (index, type, id) {
    return client.get(index, type, id);
  },
  /**
   * @param {string} index
   * @param {string} type
   * @param {string} id
   * @param {object} doc
   * @returns {Promise}
   */
  put: function (index, type, id, doc) {
    return client.put(index, type, id, doc);
  },
  /**
   * @param {string} id
   * @returns {Promise}
   */
  delete: function (index, type, id) {
    return client.delete(index, type, id);
  },
  /**
   *
   * @param indices List of indices to search in
   * @param types List of types to search in
   * @param query Specific to the DSL used by your search engine
   * @param ops Supports:
   *  limit: default to 10
   *  skip:  default to 0
   *  sort:  default to search_score, else when sorting by a specific field or anything else
   *         , scoring is ignored and only filtering matters. Filtering is implemented
   *         in the adapter, so the client does not have to send custom dsl for filtering only
   *  include: specify list of fields to return in response, default to all
   *  exclude: specify list of fields to exclude in response, default to none
   *
   * @returns {Promise} wrapping {items:[], total:254}
   */
  search: function (indices, types, query, ops) {
    return client.search(indices, types, query, ops);
  },
  /**
   * Delete indices
   * @param indices An array of indices names or * for all
   * @returns {Promise}
   */
  deleteIndices: function (indices) {
    return client.deleteIndices(indices);
  },
  /**
   * @param {[{index:index, type:type, command:put, id:id, doc:doc}]} ops
   *  type is in put, del
   *  doc is omitted when del
   *  doc is expected to be complete doc, not partial and an object, not a stringified json obj
   * @returns {Promise}
   */
  batch: function (ops) {
    return client.batch(ops);
  },
 /**
   * Util function mapping db ops batch input to search batch input
   * @param ops batch input expected by db.js
   * @returns {Promise}
   */
  batchDBFormat: function (ops) {
    const searchOps = _.map(ops, function (op) {
      return {
        index: op.index,
        type: op.indexType,
        doc: toJson(op.value),
        id: op.key,
        command: op.type
      };
    });
    return this.batch(searchOps);
  },
  /**
   * Returns a boolean in a promise testing index existence
   * @param name
   * @returns {Promise}
   */
  hasIndex: function (name) {
    return client.hasIndex(name);
  },
  /**
   * Create an index with the given name. Errors out if index already exists
   * @param name the name of the index
   * @param body the object to specify the index settings -specific to the search engine-
   * @returns {Promise}
   */
  createIndex: function (name, body) {
    return client.createIndex(name, body);
  },
  switchSearchEngine: function (searchModule) {
    //Default is mock
    if (!searchModule) {
      searchModule = mocksearch;
    }
    //Should contain at least the contract api
    const apiFcts = ['put', 'get', 'delete', 'search', 'deleteIndices', 'batch', 'hasIndex', 'createIndex'];
    var validated = _.every(apiFcts, function (it) {
      return _.includes(_.keys(searchModule), it);
    });
    if (!validated) {
      throw new Error('Search engine does not respect interface contract');
    } else {
      client = searchModule;
    }
  },
  /**
   * Only indexes components with valid uri
   * @param id the uri of the component instance
   * @returns {{}} {index:..., type: ...} -> search engine index name and type name
   */
  getSearchIndex: function (id) {
    const siteAndComponent = references.extractSiteAndComponent(id);
    const version = references.extractVersion(id);
    var op = {};
    op.type = (version === 'published') ? 'published' : 'draft';
    if (siteAndComponent){
      var site = '';
      if (siteAndComponent.site) {
        site = siteAndComponent.site + '-';
      }
      //We prefix we amphora
      op.index = 'amphora-' + site + siteAndComponent.component;
    }
    return op;
  },
  /**
   * Only apply a put or delete operation on a valid index, otherwise just return empty promise
   * @param id uri of a component instance
   * @param op the operation to be performed in the form function(index, type){your put or delete op code}
   * @returns {*} A promise
   */
  applyDelOrPut: function (id, op) {
    var fullIndex = this.getSearchIndex(id);
    if (fullIndex.index){
      return op(fullIndex.index, fullIndex.type);
    } else {
      return bluebird.resolve();
    }
  }
};