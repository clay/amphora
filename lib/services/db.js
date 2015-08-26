'use strict';

var _ = require('lodash'),
  levelup = require('./adapters/levelup'),
  chalk = require('chalk'),
  engine = levelup;

//Not sure if there is better way to proxy this
module.exports = {
  /**
   * @param {string} key
   * @returns {Promise} returning value or error -error name has to be NotFoundError-
   */
  get: function (key) {
    return engine.get(key);
  },
  /**
   * @param {string} key
   * @param {string} value
   * @returns {Promise}
   */
  put: function (key, value) {
    return engine.put(key, value);
  },
  /**
   * @param {string} key
   * @returns {Promise}
   */
  del: function (key) {
    return engine.del(key);
  },
  /**
   * Get a read stream of all the keys.
   *
   * @example db.list({prefix: '/components/hey'})
   *
   * @param {object} [options]
   *    options supports:
   *          keys: boolean default true, return only keys
   *          values: boolean default true, return only values
   *
   *          isArray: boolean returns the result as an array in the format [{"key":"1","value":"2"},{"key":"3","value":"4"},{"key":"5","value":"6"}]
   *                           or as simple array if only returning keys or values ["2","4","6"]
   *                           default is false when keys/values both set to true
   *          skip: default is 0
   *          limit: default is 10
   *          prefix: string to search by key name prefix
   *                  ex: key could  be /foo/bar and retrieved with prefix /foo/
   *    Return a readable stream and results are sorted by key names
   * @returns {ReadStream}
   */
  list: function (options) {
    return engine.list(options);
  },
  /**
   * Clear all records from the DB.  (useful for unit testing)
   */
  clear: function () {
    return engine.clear();
  },
  /**
   * Format a series of batch operations in a consistent way.
   * Used for logging to the console
   *
   * @param {[{type: string, key: string, value: string}]} ops
   * @returns {string}
   */
  formatBatchOperations: function (ops) {
    return _.map(ops, function (op) {
      var str,
        value = op.value;
      try {
        value = require('util').inspect(JSON.parse(value), {showHidden: false, depth: 5, colors: true});
        if (value.indexOf('\n') !== -1) {
          value = '\n' + value;
        }
      } catch (x) {
        // do nothing
      } finally {
        str = ' ' + chalk.blue(op.key + ': ') + chalk.dim(value);
      }
      return str;
    }).join('\n');
  },
  /**
   * @param {[{type: string, key: string, value: string}]} ops
   * @param {object} [options]
   * @returns {Promise}
   */
  batch: function (ops, options) {
    return engine.batch(ops, options);
  },
  /**
   * Switch a new storage engine -default is levelup with memdown-
   * @param dbModule, the variable holding of require('my-db-adapter') exporting the db interface
   * CONTRACT to be implemented (exported functions) by the dbModule (described above):
   * 1. put(string, string)
   * 2. get(string)
   * 3. del(string)
   * 4. batch(ops)
   * 5. clear()
   * 6. list(options: object)
   *
   *
   Client project using byline may use a adapter like redis with this code snippetL
   var db = require('@nymdev/byline').db;
   if(process.env.REDIS_HOST){
                    var pottery = require('@nymdev/clay-pottery');
                    pottery.connect(({port: 6379, host: process.env.REDIS_HOST}));
                    db.switchStorageEngine(pottery);
                 }
   */
  switchStorageEngine: function (dbModule) {
    //Default is levelup
    if (!dbModule) {
      dbModule = levelup;
    }
    //Should contain at least the contract api
    const apiFcts = ['put', 'get', 'del', 'list', 'clear', 'batch'];
    var validated = _.every(apiFcts, function (it) {
      return _.includes(_.keys(dbModule), it);
    });
    if (!validated) {
      throw new Error('DB engine does not respect interface contract');
    } else {
      engine = dbModule;
    }
  }
};
