'use strict';
var winston = require('winston');

// default to console logger, but pretty-print it
winston.remove(winston.transports.Console);
winston.add(winston.transports.Console, { colorize: true });

module.exports = winston;