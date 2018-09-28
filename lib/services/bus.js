'use strict';

const Redis = require('ioredis'),
  NAMESPACE = process.env.CLAY_BUS_NAMESPACE || 'clay';
var log = require('./logger').setup({ file: __filename });

/**
 * Connect to the bus Redis instance
 */
function connect(busModule) {
  if (busModule) {
    busModule.connect();
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
  if (!topic || !msg || typeof topic !== 'string' || typeof msg !== 'string') {
    throw new Error('A `topic` and `msg` property must be defined and both must be strings');
  }

  if (module.exports.client) {
    module.exports.client.publish(`${NAMESPACE}:${topic}`, msg);
  }
}

module.exports.connect = connect;
module.exports.publish = publish;

// For testing
module.exports.client = undefined;
