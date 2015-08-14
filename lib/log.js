'use strict';
var winston = require('winston'),
  chalk = require('chalk');

// default to console logger, but pretty-print it
winston.remove(winston.transports.Console);
winston.add(winston.transports.Console, { colorize: true });


module.exports = winston;

/**
 * Dims the log slightly.
 * @param {string} msg
 */
module.exports.logLess = function (msg) {
  winston.info(chalk.dim(msg));
}