'use strict';

const bluebird = require('bluebird');

/**
 * Bluebird.defer migration
 * http://bluebirdjs.com/docs/api/deferred-migration.html
 *
 * Bluebird.defer is deprecated and this is the migration
 * as supplied by Bluebird.
 * @return {object}
 */
module.exports = function () {
  var resolve, reject,
    promise = new bluebird(function () {
      resolve = arguments[0];
      reject = arguments[1];
    });

  return {
    resolve: resolve,
    reject: reject,
    promise: promise
  };
};
