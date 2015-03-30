//for now, use memory.
var db = require('levelup')('whatever', { db: require('memdown') });

/**
 * Use ES6 promises
 * @returns {{}}
 */
function defer() {
  var defer = {};
  defer.promise = new Promise(function (resolve, reject) {
    defer.resolve = resolve;
    defer.reject = reject;
    defer.apply = function (err, result) {
      if (err) {
        defer.reject(err);
      } else {
        defer.resolve(result);
      }
    }
  });
  return defer;
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