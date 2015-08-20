var bluebird = require('bluebird');

function mock(res){
  //Not a real search implementation. Should not be called in any real application wanting a search functionality. In unit test only
  return bluebird.resolve(res);
}

module.exports = {
  /**
   * @param {string} index
   * @param {string} type
   * @param {string} id
   * @returns {Promise} returning value or error -error name has to be NotFoundError-
   */
  get: function (index, type, id) {
    return mock({});
  },
  /**
   * @param {string} index
   * @param {string} type
   * @param {string} id
   * @param {object} doc
   * @returns {Promise}
   */
  put: function (index, type, id, doc) {
    return mock();
  },
  /**
   * @param {string} id
   * @returns {Promise}
   */
  delete: function (index, type, id) {
    return mock();
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
   * @returns {Promise}
   */
  search: function (indices, types, query, ops) {
    return mock({items:[], total:0});
  },
  /**
   * Delete indices
   * @param indices An array of indices names or * for all
   * @returns {Promise}
   */
  deleteIndices: function (indices) {
    return mock();
  },
  /**
   * @param {[{index:index, type:type, command:put, id:id, doc:doc}]} ops
   *  type is in put, del
   *  doc is omitted when del
   *  doc is expected to be complete doc, not partial and an object, not a stringified json obj
   * @returns {Promise}
   */
  batch: function (ops) {
    return mock();
  },
  /**
   * Returns a boolean in a promise testing index existence
   * @param name
   * @returns {Promise}
   */
  hasIndex: function (name) {
    return mock(true);
  },
  /**
   * Create an index with the given name. Errors out if index already exists
   * @param name the name of the index
   * @param body the object to specify the index settings -specific to the search engine-
   * @returns {Promise}
   */
  createIndex: function (name, body) {
    return mock();
  }
};