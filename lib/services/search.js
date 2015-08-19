var elasticsearch = require('elasticsearch'),
  _ = require('lodash');

const limit = 10;

function mapOptions (opts) {
  var esOptions = {
    size : (opts.limit) ? opts.limit : limit,
    from : (opts.skip) ? opts.skip : 0
  };
  if (opts.sort) {
    esOptions.sort = opts.sort;
  }
  if (opts.include) {
    esOptions._sourceInclude = opts.include;
  }
  if (opts.exclude) {
    esOptions._sourceExclude = opts.exclude;
  }
  return esOptions;
 }

function hasNoScoring(sort){
  return sort && sort !== 'search_score';
}


/**
 * Filters are faster than queries when no scoring
 * @param query An elastic search query {query:{...}}
 * @returns {{query: {constant_score: query}}}
 */
function wrapQueryNoScoring (query){
  return {
    query:{
      constant_score: query
    },
    _cache : true
  }
}


var client;
module.exports = {
  /**
   * Transforms a str into a json obj
   *  * @param val, a json str or a primitive type
   * @returns {object} If val is not an obj or an array, then returns {value: val}
   */
  toJson: function (val) {
    const firstChar = val.charAt(0);
    if (firstChar !== '[' && firstChar !== '{') {
      return {value: val};
    } else {
      return JSON.parse(val);
    }
  },
  /**
   * @param {string} id
   * @returns {Promise} returning value or error -error name has to be NotFoundError-
   */
  get: function (id) {
    return client.get(id);
  },
  /**
   * @param {string} index
   * @param {string} type
   * @param {string} id
   * @param {object} doc
   * @returns {Promise}
   */
  put: function (index, type, id, doc) {
    return client.index({
      index: index,
      type: type,
      id: id,
      body: doc
    });
  },
  /**
   * @param {string} id
   * @returns {Promise}
   */
  delete: function (index, type, id) {
    return client.delete({
      index: index,
      type: type,
      id: id
    });
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
    if (hasNoScoring(ops.sort)) {
      query = wrapQueryNoScoring(query);
    }
    const esQuery = _.merge(mapOptions(ops), {body: query});
    return client.search(esQuery);
  },
  /**
   * Delete indices
   * @param indices An array of indices names or * for all
   * @returns {Promise}
   */
  deleteIndices: function (indices) {
    return client.indices.delete({index: indices});
  },
  /**
   * @param {[{index:index, type:type, command:put, id:id, doc:doc}]} ops
   *  type is in put, del
   *  doc is omitted when del
   *  doc is expected to be complete doc, not partial and an object, not a stringified json obj
   * @returns {Promise}
   */
  batch: function (ops) {
    const input = _.flatten(_.map(ops, function (op) {
      const ref = { _index: op.index, _type: op.type, _id: op.id };
      switch (op.command.toLowerCase()) {
        case 'put':
          return [
            {index: ref},
            op.doc
          ];
        case 'del':
          return [
            {delete: ref}
          ];
      }
    }));
    return client.bulk({body: input});
  },
  /**
   * Util function mapping db ops batch input to search batch input
   * @param ops batch input expected by db.js
   * @returns {Promise}
   */
  batchDBFormat: function (ops) {
    const ref = this;
    const searchOps = _.map(ops, function (op) {
      return {
        index: op.index,
        type: op.indexType,
        doc: ref.toJson(op.value),
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
    return client.indices.exists({index: name});
  },
  /**
   * Create an index with the given name. Errors out if index already exists
   * @param name the name of the index
   * @param body the object to specify the index settings -specific to the search engine-
   * @returns {Promise}
   */
  createIndex: function (name, body) {
    return client.indices.create({index: name, body: body});
  },
  switchStorageEngine: function (dbModule) {
    //Should contain at least the contract api
    const apiFcts = ['put', 'get', 'delete', 'search', 'deleteIndices', 'batch', 'hasIndex', 'createIndex'];
    var validated = _.every(apiFcts, function (it) {
      return _.includes(_.keys(dbModule), it);
    });
    if (!validated) {
      throw new Error('Search engine does not respect interface contract');
    } else {
      client = dbModule;
    }
  },
  /**
   * Connect to elastic
   * @param opts required are port and host, optional is options
   */
  connect: function (opts) {
    client = new elasticsearch.Client(opts);
  }
};

module.exports.connect({host:'localhost:9200', log:'info'});