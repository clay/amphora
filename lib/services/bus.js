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
 * @param  {String} topic
 * @param  {String} msg
 */
function publish(topic, msg) {
  if (!topic || !msg || typeof topic !== 'string' || typeof msg !== 'object') {
    throw new Error('A `topic` (string) and `msg` (object) property must be defined');
  }

  if (module.exports.client && BUS_MODULE) {
    module.exports.client.publish(`${NAMESPACE}:${topic}`, msg);
  } else if (module.exports.client) {
    module.exports.client.publish(`${NAMESPACE}:${topic}`, JSON.stringify(msg));
  }
}

module.exports.connect = connect;
module.exports.publish = publish;

// For testing
module.exports.client = undefined;
module.exports.setLog = mock => log = mock;
