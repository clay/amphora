'use strict';

const _ = require('lodash'),
  jsonTransform = require('./../streams/json-transform'),
  promiseDefer = require('../utils/defer'),
  { replaceVersion } = require('clayutils');

/**
 * Use ES6 promises
 * @returns {{apply: function}}
 */
function defer() {
  const def = promiseDefer();

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

  pipe.on('data', data => str += data)
    .on('error', d.reject)
    .on('end', () => d.resolve(str));
  return d.promise;
}

/**
 * Get a read stream of all the keys.
 *
 * @example db.list({prefix: '/_components/hey'})
 *
 * WARNING:  Try to always end with the same character (like a /) or be completely consistent with your prefixing
 * because the '/' character is right in the middle of the sorting range of characters.  You will get weird results
 * if you're not careful with your ending character.  For example, `/_components/text` will also return the entries of
 * `/_components/text-box`, so the search should really be `/_components/text/`.
 *
 * @param {object} [options]
 * @returns {ReadStream}
 */
/* eslint-disable complexity */
function list(options = {}) {
  options = _.defaults(options, {
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

  readStream = module.exports.createReadStream(options);

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
 * Get latest data of uri@latest
 * @param {string} uri
 * @returns {Promise}
 */
function getLatestData(uri) {
  return module.exports.get(replaceVersion(uri));
}

/**
 * Register the storage module by assigning its
 * methods to the exports of the internal db module
 *
 * @param  {Object} storage
 */
function registerStorage(storage) {
  for (let action in storage) {
    module.exports[action] = storage[action];
  }
}

module.exports.list = list;
module.exports.getLatestData = getLatestData;
module.exports.pipeToPromise = pipeToPromise;
module.exports.registerStorage = registerStorage;

// methods from storage module, assigned in registerStorage
module.exports.put;
module.exports.get;
module.exports.del;
module.exports.batch;
module.exports.putMeta;
module.exports.patchMeta;
module.exports.getMeta;
module.exports.raw;
module.exports.createReadStream;

// For testing
module.exports.defer = defer;
