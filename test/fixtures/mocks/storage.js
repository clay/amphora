'use strict';

const sinon = require('sinon'),
  db = require('../../../lib/services/db'),
  { replaceVersion } = require('clayutils'),
  // One store shared by every Storage the tests create, as memdown 1.x did (it kept
  // a global store per location). memdown 6 isolates each instance, but tests such as
  // db.test.js register a new Storage per test while the API tests write through
  // another one, and rely on both seeing the same data. levelup 5 returns Buffers
  // unless told otherwise; encoding-down restores the utf8 strings levelup 1 returned.
  inMem = require('levelup')(require('encoding-down')(require('memdown')(), { keyEncoding: 'utf8', valueEncoding: 'utf8' }));

class Storage {
  constructor() {
    this.inMem            = inMem;
    this.setup            = sinon.stub().returns(Promise.resolve());
    this.get              = sinon.stub();
    this.put              = sinon.stub();
    this.del              = sinon.stub();
    this.batch            = sinon.stub();
    this.getMeta          = sinon.stub();
    this.putMeta          = sinon.stub();
    this.patchMeta        = sinon.stub();
    this.getLists         = sinon.stub();
    this.list             = db.list;
    this.clearMem         = this.clear;
    this.pipeToPromise    = db.pipeToPromise;
    this.createReadStream = (ops) => this.inMem.createReadStream(ops);
    this.getLatestData    = sinon.stub();

    db.registerStorage(this);
  }

  defer() {
    return db.defer();
  }

  /**
   * Save to inMemDb
   *
   * @param  {String} key
   * @param  {String} value
   * @return {Promise}
   */
  writeToInMem(key, value) {
    const deferred = this.defer();

    // levelup 1 stored String(value), so a test that seeds `undefined` (for example
    // a typo like data.firstLevelComponent) saved 'undefined'; levelup 5 throws
    this.inMem.put(key, value === undefined || value === null ? String(value) : value, deferred.apply);
    return deferred.promise;
  }

  getLatestFromInMem(key) {
    const deferred = this.defer();

    this.inMem.get(replaceVersion(key), deferred.apply);
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


  patchMetaInMem(key, value) {
    const deferred = this.defer();

    this.inMem.put(`${key}/meta`, value, deferred.apply);
    return deferred.promise
      .then(() => value);
  }

  /**
   * Get from the inMemDb
   * @param  {String} key
   * @return {Promise}
   */
  getFromInMem(key) {
    const deferred = this.defer();

    this.inMem.get(key, deferred.apply);
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

  /**
   * Delete to inMemDb
   * @param  {String} key
   * @return {Promise}
   */
  delFromInMem(key) {
    const deferred = this.defer();

    this.inMem.del(key, deferred.apply);
    return deferred.promise;
  }

  /**
   * Process a batch
   * @param  {Array} ops
   * @param  {Object} options
   * @return {Promise}
   */
  batchToInMem(ops, options) {
    const deferred = this.defer();

    this.inMem.batch(ops, options || {}, deferred.apply);

    return deferred.promise;
  }

  putMetaInMem(key, value) {
    const deferred = this.defer();

    this.inMem.put(`${key}/meta`, value, deferred.apply);
    return deferred.promise
      .then(() => value);
  }

  getMetaInMem(key) {
    const deferred = this.defer();

    this.inMem.get(`${key}/meta`, deferred.apply);
    return deferred.promise
      .catch(() => ({}));
  }

  /**
   * Clear the Db
   * @return {Promise}
   */
  clear() {
    const errors = [],
      ops = [],
      deferred = this.defer();

    this.inMem.createReadStream({
      keys:true,
      fillCache: false,
      limit: -1
    })
      .on('data', data => ops.push({ type: 'del', key: data.key}))
      .on('error', error => errors.push(error))
      .on('end', () => {
        if (errors.length) {
          deferred.apply(_.head(errors));
        } else {
          this.inMem.batch(ops, deferred.apply);
        }
      });

    return deferred.promise;
  }
}

module.exports = () => new Storage();
