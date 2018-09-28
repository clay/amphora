'use strict';

const _ = require('lodash'),
  bluebird = require('bluebird'),
  upgrade = require('./upgrade'),
  timer = require('../timer'),
  TIMEOUT_GET_COEFFICIENT = 2,
  TIMEOUT_PUT_COEFFICIENT = 5;
var TIMEOUT_CONSTANT = 4000,
  db = require('./db'),
  log = require('./logger').setup({ file: __filename });

/**
 * Execute the save function of a model.js file
 * for either a component or a layout
 *
 * @param {Object} model
 * @param {String} uri
 * @param {Object} data
 * @param {Object} locals
 * @returns {Object}
 */
function put(model, uri, data, locals) {
  const startTime = process.hrtime(),
    timeoutLimit = TIMEOUT_CONSTANT * TIMEOUT_PUT_COEFFICIENT;

  return bluebird.try(() => {
    return bluebird.resolve(model.save(uri, data, locals))
      .then(resolvedData => {
        if (!_.isObject(resolvedData)) {
          throw new Error(`Unable to save ${uri}: Data from model.save must be an object!`);
        }

        return {
          key: uri,
          type: 'put',
          value: JSON.stringify(resolvedData)
        };
      });
  }).tap(() => {
    const ms = timer.getMillisecondsSince(startTime);

    if (ms > timeoutLimit * 0.5) {
      log('warn', `slow put ${uri} ${ms}ms`);
    }
  }).timeout(timeoutLimit, `Module PUT exceeded ${timeoutLimit}ms: ${uri}`);
}

/**
 * Execute the get function of a model.js file
 * for either a component or a layout
 *
 * @param {Object} model
 * @param {Object} renderModel
 * @param {Boolean} executeRender
 * @param {String} uri
 * @param {Object} locals
 * @returns {Promise}
 */
function get(model, renderModel, executeRender, uri, locals) { /* eslint max-params: ["error", 5] */
  var promise;

  if (executeRender) {
    const startTime = process.hrtime(),
      timeoutLimit = TIMEOUT_CONSTANT * TIMEOUT_GET_COEFFICIENT;

    promise = bluebird.try(() => {
      return db.get(uri)
        .then(upgrade.init(uri, locals)) // Run an upgrade!
        .then(data => model.render(uri, data, locals));
    }).tap(result => {
      const ms = timer.getMillisecondsSince(startTime);

      if (!_.isObject(result)) {
        throw new Error(`Component model must return object, not ${typeof result}: ${uri}`);
      }

      if (ms > timeoutLimit * 0.5) {
        log('warn', `slow get ${uri} ${ms}ms`);
      }
    }).timeout(timeoutLimit, `Model GET exceeded ${timeoutLimit}ms: ${uri}`);

  } else {
    promise = db.get(uri).then(upgrade.init(uri, locals)); // Run an upgrade!
  }

  if (renderModel && _.isFunction(renderModel)) {
    promise = promise.then(data => renderModel(uri, data, locals));
  }

  return promise.then(data => {
    if (!_.isObject(data)) {
      throw new Error(`Client: Invalid data type for component at ${uri} of ${typeof data}`);
    }

    return data;
  });
}

module.exports.get = get;
module.exports.put = put;

// For testing
module.exports.getTimeoutConstant = () => TIMEOUT_CONSTANT;
module.exports.setTimeoutConstant = val => TIMEOUT_CONSTANT = val;
module.exports.setLog = mock => log = mock;
module.exports.setDb = mock => db = mock;
