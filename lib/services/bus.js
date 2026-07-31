'use strict';

const Redis = require('ioredis'),
  NAMESPACE = process.env.CLAY_BUS_NAMESPACE || 'clay';
var log = require('./logger').setup({ file: __filename }),
  BUS_MODULE = false;

/**
 * Connect to the bus Redis instance
 *
 * @param {Object} busModule
 */
function connect(busModule) {
  if (busModule) {
    module.exports.client = busModule.connect();
    BUS_MODULE = true;
  } else {
    log('info', `Connecting to default Redis event bus at ${process.env.CLAY_BUS_HOST}`);
    module.exports.client = new Redis(process.env.CLAY_BUS_HOST);
  }
}

/**
 * Publish a message to the bus.
 *
 * Always returns a Promise, but only an injected bus module's Promise is
 * adopted. When a `busModule` was passed to `connect`, whatever its `publish`
 * returns is returned here, so callers that chain on it (`pages.applyBatch`,
 * `db-operations.cascadingPut`) wait on the bus module and its rejections
 * propagate to them.
 *
 * The default ioredis client stays fire-and-forget: its return value is
 * dropped, so a failed publish resolves here and its error is not surfaced to
 * the caller. That is deliberate, not an oversight. Both `save` call sites
 * publish *after* `db.batch` has already committed to the database, so
 * adopting the default client's Promise would let ordinary Redis latency, a
 * disconnect, or a queued command delay or fail a page/component save that has
 * in fact already succeeded -- for every consumer that never asked for it.
 * A consumer that wants bus failures to fail the request opts in by supplying
 * a bus module.
 *
 * The `msg` vs `JSON.stringify(msg)` asymmetry below is pre-existing: a bus
 * module serializes the message itself, the default client does not.
 *
 * @param  {String} topic
 * @param  {String} msg
 * @returns {Promise} the bus module's Promise, otherwise an already-resolved one
 */
function publish(topic, msg) {
  if (!topic || !msg || typeof topic !== 'string' || typeof msg !== 'object') {
    throw new Error('A `topic` (string) and `msg` (object) property must be defined');
  }

  if (module.exports.client && BUS_MODULE) {
    return Promise.resolve(module.exports.client.publish(`${NAMESPACE}:${topic}`, msg));
  }

  if (module.exports.client) {
    // intentionally not returned, see above
    module.exports.client.publish(`${NAMESPACE}:${topic}`, JSON.stringify(msg));
  }

  return Promise.resolve();
}

module.exports.connect = connect;
module.exports.publish = publish;

// For testing
module.exports.client = undefined;
module.exports.setLog = mock => log = mock;
