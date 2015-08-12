var _ = require('lodash'),
    levelup = require('./db-adapters/levelup');

//Default storage engine is levelup in memory
module.exports = levelup;


/**
 * Switch a new storage engine -default is levelup with memdown-
 * @param dbModule, the variable holding of require('my-db-adapter') exporting the db interface
 * CONTRACT to be implemented (exported functions) by the dbModule:
 * 1. put(string, string): returns Promise with no used value
 * 2. get(string): returns Promise returning value or error -error name has to be NotFoundError-
 * 3. del(string): returns Promise with no used value
 * 4. formatBatchOperations([{type: string, key: string, value: string}]: returns a structure which has to be understood by batch
 * 5. batch(structure returned by formatBatchOperations): executes a batch of commands and return a promise with no used value
 * 6. clear(): clear all the records
 * 7. list(options: object)
 *      options supports:
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
 *
 *
 *    Client project using byline may use a adapter like redis with this code snippetL
 *       var db = require('@nymdev/byline').db;
         if(process.env.REDIS_HOST){
            var pottery = require('clay-pottery');
            pottery.connect(({port: 6379, host: process.env.REDIS_HOST}));
            db.switchStorageEngine(require('clay-pottery'));
         }
 *
 */
module.exports.switchStorageEngine = function (dbModule) {
    _.merge(module.exports, dbModule);
};
