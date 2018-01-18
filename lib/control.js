'use strict';

var memoryLeakThreshold = 32768,
  log = require('./services/logger').setup({
    file: __filename
  });
const _ = require('lodash'),
  minute = 60000;

/**
 * @param {*} obj
 * @returns {boolean}
 */
function isFreezable(obj) {
  const type = typeof obj;

  // NOTE: leave functions allow, despite object-like behavior.  We need them for stubs.
  return type === 'object' && obj !== null && Object.isFrozen && !Object.isFrozen(obj);
}

/**
 * Set object to read-only (in-place)
 *
 * @param {*} obj
 * @returns {*}
 */
function setReadOnly(obj) {
  if (isFreezable(obj)) {
    _.forOwn(obj, function (value) {
      if (typeof value === 'object' && value !== null) {
        setReadOnly(value);
      }
    });

    Object.freeze(obj);
  }
  return obj;
}

function defineReadOnly(definition) {
  if (!definition.get) {
    definition.writable = false;
  }
  definition.enumerable = false;
  definition.configurable = false;
  delete definition.set;
  return definition;
}

function defineWritable(definition) {
  if (!definition.set && !definition.get) {
    definition.writable = true;
  }
  definition.enumerable = false;
  definition.configurable = false;
  return definition;
}

/**
 * Report that a memory leak occurred
 * @param {function} fn
 * @param {object} cache
 */
function reportMemoryLeak(fn, cache) {
  log('warn', `memory leak ${fn.name} ${JSON.stringify(cache)}`);
}

/**
 * Memoize, but warn if the target is not suitable for memoization
 *
 * Use this if you want memory leak logging.
 *
 * @param {function} fn
 * @returns {function}
 */
function memoize(fn) {
  const dataProp = '__data__.string.__data__',
    memFn = _.memoize.apply(_, _.slice(arguments)),
    report = _.throttle(reportMemoryLeak, minute),
    controlFn = function () {
      const result = memFn.apply(null, _.slice(arguments));

      if (_.size(_.get(memFn, `cache.${dataProp}`)) >= memoryLeakThreshold) {
        report(fn, _.get(memFn, `cache.${dataProp}`));
      }

      return result;
    };

  Object.defineProperty(controlFn, 'cache', defineWritable({
    get() { return memFn.cache; },
    set(value) { memFn.cache = value; }
  }));

  return controlFn;
}

function setMemoryLeakThreshold(value) {
  memoryLeakThreshold = value;
}

function getMemoryLeakThreshold() {
  return memoryLeakThreshold;
}

module.exports.setReadOnly = setReadOnly;
module.exports.defineReadOnly = defineReadOnly;
module.exports.defineWritable = defineWritable;
module.exports.memoize = memoize;

module.exports.setMemoryLeakThreshold = setMemoryLeakThreshold;
module.exports.getMemoryLeakThreshold = getMemoryLeakThreshold;

// For testing
module.exports.setLog = function (fakeLogger) {
  log = fakeLogger;
};
