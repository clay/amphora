/**
 * Mostly just converts callbacks to Promises
 *
 * @module
 */

'use strict';

//for now, use memory.
var _ = require('lodash'),
  db = require('levelup')('whatever', { db: require('memdown') }),
  bluebird = require('bluebird'),
  jsonTransform = require('./streams/json-transform');

/**
 * Use ES6 promises
 * @returns {{}}
 */
function defer() {
  var def = bluebird.defer();
  def.apply = function (err, result) {
    if (err) {
      def.reject(err);
    } else {
      def.resolve(result);
    }
  };
  return def;
}

/**
 *
 * @param {string} key
 * @param {string} value
 * @returns {Promise}
 */
module.exports.put = function (key, value) {
  var deferred = defer();
  db.put(key, value, deferred.apply);
  return deferred.promise;
};

/**
 *
 * @param {string} key
 * @returns {Promise}
 */
module.exports.get = function (key) {
  var deferred = defer();
  db.get(key, deferred.apply);
  return deferred.promise;
};

/**
 *
 * @param {string} key
 * @returns {Promise}
 */
module.exports.del = function (key) {
  var deferred = defer();
  db.del(key, deferred.apply);
  return deferred.promise;
};

/**
 * Get a read stream of all the keys.
 *
 * @example db.list({prefix: '/components/hey'})
 *
 * WARNING:  Try to always end with the same character (like a /) or be completely consistent with your prefixing
 * because the '/' character is right in the middle of the sorting range of characters.  You will get weird results
 * if you're not careful with your ending character.  For example, `/components/text` will also return the entries of
 * `/components/text-box`, so the search should really be `/components/text/`.
 *
 * @param {object} [options]  Defaults to limit of 10.
 * @returns {ReadStream}
 */
module.exports.list = function (options) {
  options = _.defaults(options || {}, {
    limit: 10,
    keys: true,
    values: true,
    fillCache: false
  });

  //The prefix option is a shortcut for a greaterThan and lessThan range.
  if (options.prefix) {
    // \x00 is the first possible alphanumeric character, and /xFF is the last
    options.gte = options.prefix + '\x00';
    options.lte = options.prefix + '\xff';
  }

  var transformOptions = {
    objectMode: options.values,
    isArray: options.isArray
  };

  //if keys but no values, or values but no keys, always return as array.
  if ((options.keys && !options.values) || (!options.keys && options.values)) {
    transformOptions.isArray = true;
  }

  return db.createReadStream(options).pipe(jsonTransform(transformOptions));
};

/**
 * @param {Array} ops
 * @param {object} [options]
 * @returns {Promise}
 */
module.exports.batch = function (ops, options) {
  var deferred = defer();
  db.batch(ops, options || {}, deferred.apply);
  return deferred.promise;
};