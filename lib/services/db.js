/**
 * Mostly just converts callbacks to Promises
 *
 * @module
 */

'use strict';

// for now, use memory.

const _ = require('lodash'),
  bluebird = require('bluebird'),
  jsonTransform = require('./../streams/json-transform'),
  chalk = require('chalk'),
  Eventify = require('eventify'),
  validation = require('../validation');
let db = require('levelup')('whatever', { db: require('memdown') });

/**
 * Use ES6 promises
 * @returns {{apply: function}}
 */
function defer() {
  const def = bluebird.defer();

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
 * Convert a pipe (stream) to a promise
 *
 * @param {Stream} pipe
 * @returns {Promise}
 */
function pipeToPromise(pipe) {
  const d = defer();
  let str = '';

  pipe.on('data', function (data) { str += data; })
    .on('error', d.reject)
    .on('end', function () { d.resolve(str); });
  return d.promise;
}

/**
 * @param {string} key
 * @param {string} value
 * @returns {Promise}
 */
function put(key, value) {
  validation.assertValidValue('put', value);
  const deferred = defer();

  db.put(key, value, deferred.apply);
  return deferred.promise;
}

/**
 * @param {string} key
 * @returns {Promise}
 */
function get(key) {
  const deferred = defer();

  db.get(key, deferred.apply);
  return deferred.promise;
}

/**
 * @param {string} key
 * @returns {Promise}
 */
function del(key) {
  const deferred = defer();

  db.del(key, deferred.apply);
  return deferred.promise;
}

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
 * @param {object} [options]
 * @returns {ReadStream}
 */
function list(options) {
  options = _.defaults(options || {}, {
    limit: -1,
    keys: true,
    values: true,
    fillCache: false,
    json: true
  });

  // The prefix option is a shortcut for a greaterThan and lessThan range.
  if (options.prefix) {
    // \x00 is the first possible alphanumeric character, and \xFF is the last
    options.gte = options.prefix + '\x00';
    options.lte = options.prefix + '\xff';
  }

  let readStream,
    transformOptions = {
      objectMode: options.values,
      isArray: options.isArray
    };

  // if keys but no values, or values but no keys, always return as array.
  if (options.keys && !options.values || !options.keys && options.values) {
    transformOptions.isArray = true;
  }

  readStream = db.createReadStream(options);

  if (_.isFunction(options.transforms)) {
    options.transforms = options.transforms();
  }

  // apply all transforms
  if (options.transforms) {
    readStream = _.reduce(options.transforms, function (readStream, transform) {
      return readStream.pipe(transform);
    }, readStream);
  }

  if (options.json) {
    readStream = readStream.pipe(jsonTransform(transformOptions));
  }

  return readStream;
}

/**
 * @param {Array} ops
 * @param {object} [options]
 * @returns {Promise}
 */
function batch(ops, options) {
  validation.assertValidBatchOps(ops);
  const deferred = defer();

  db.batch(ops, options || {}, deferred.apply);
  return deferred.promise;
}

/**
 * Clear all records from the DB.  (useful for unit testing)
 * @returns {Promise}
 */
function clear() {
  const errors = [],
    ops = [],
    deferred = defer();

  db.createReadStream({
    keys:true,
    fillCache: false,
    limit: -1
  }).on('data', function (data) {
    ops.push({ type: 'del', key: data.key});
  }).on('error', function (error) {
    errors.push(error);
  }).on('end', function () {
    if (errors.length) {
      deferred.apply(_.head(errors));
    } else {
      db.batch(ops, deferred.apply);
    }
  });

  return deferred.promise;
}

/**
 * Format a series of batch operations in a consistent way.
 * Used for logging to the console
 *
 * @param {[{type: string, key: string, value: string}]} ops
 * @returns {string}
 */
function formatBatchOperations(ops) {
  return _.map(ops, function (op) {
    let str,
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
}

module.exports.get = get;
module.exports.put = put;
module.exports.del = del;
module.exports.list = list;
module.exports.batch = batch;
module.exports.clear = clear;
module.exports.formatBatchOperations = formatBatchOperations;
module.exports.getDB = function () { return db; };
module.exports.setDB = function (value) { db = value; };
module.exports.pipeToPromise = pipeToPromise;
Eventify.enable(module.exports);

// when any put, batch or del is made, expose it to the outside only if it is a success; also: never block for them
_.each(['put', 'batch', 'del'], function (key) {
  module.exports[key] = _.wrap(module.exports[key], function (fn) {
    const args = _.slice(arguments, 1),
      result = fn.apply(module.exports, args);

    return result.then(function (result) {
      module.exports.trigger.apply(module.exports, [key].concat(args));

      // don't wait
      return result;
    });
  });
});
