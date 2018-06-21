'use strict';

const sinon = require('sinon'),
  h = require('highland'),
  db = require('../../../lib/services/db'),
  promiseDefer = require('../../../lib/utils/defer');

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

function initDB() {
  let inMem = require('levelup')('whatever', { db: require('memdown') }),
    storage = {
      setup: sinon.stub().returns(Promise.resolve()),
      get: sinon.stub(),
      put: sinon.stub(),
      del: sinon.stub(),
      batch: sinon.stub(),
      pipeToPromise: db.pipeToPromise,
      createReadStream: (ops) => inMem.createReadStream(ops),
      writeToInMem: put,
      batchToInMem: batch,
      getFromInMem: get,
      delFromInMem: del,
      closeStream: () => stream.write(h.nil),
      clearMem: clear
    };

  function put(key, value) {
    const deferred = defer();

    inMem.put(key, value, deferred.apply);
    return deferred.promise;
  }

  function get(key) {
    const deferred = defer();

    inMem.get(key, deferred.apply);
    return deferred.promise.then(resp => {
      var returnVal;

      try {
        returnVal = JSON.parse(resp);
      } catch (e) {
        returnVal = resp;
      }

      return returnVal;
    }); // Parse because storage modules are expected to
  }

  function del(key) {
    const deferred = defer();

    inMem.del(key, deferred.apply);
    return deferred.promise;
  }

  function batch(ops, options) {
    const deferred = defer();

    inMem.batch(ops, options || {}, deferred.apply);

    return deferred.promise;
  }

  function clear() {
    const errors = [],
      ops = [],
      deferred = defer();

    inMem.createReadStream({
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
        inMem.batch(ops, deferred.apply);
      }
    });

    return deferred.promise;
  }

  db.registerStorage(storage);

  return db;
}

module.exports = initDB;