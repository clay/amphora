'use strict';

var _ = require('lodash'),
  chalk = require('chalk'),
  path = require('path'),
  winston = require('winston'),
  util = require('util'),
  logLevel = process.env.LOG || 'info';

/**
 * add ELK logging
 * note: this is in a function so we can test it
 * @param {string} elk
 */
function addELK(elk) {
  // write to elk & console if we have the CLAY_ELK env variable
  if (elk) {
    let logstashConf = {
      host: elk.split(':')[0],
      port: elk.split(':')[1],
      node_name: 'clay'
    };

    require('winston-logstash'); // only require if we're using it

    winston.add(winston.transports.Logstash, logstashConf);
  }
}

// default to console logger, but pretty-print it
winston.remove(winston.transports.Console);
winston.add(winston.transports.Console, {
  colorize: true
});
winston.default.transports.console.level = logLevel;

// addELK(process.env.CLAY_ELK); // CLAY_ELK=domain.com:9200

/**
 * @param {*} obj
 * @returns {boolean}
 */
function isError(obj) {
  return _.isError(obj) || _.isObject(obj) && obj.stack && _.endsWith(obj.name, 'Error');
}

/**
 * @param {string} dirname
 * @returns {Function}
 */
module.exports.withStandardPrefix = function (dirname) {
  const prefix = path.relative(process.cwd(), dirname).replace(/\.js$/, '').replace(/^[\.]\.\//, '');

  return function (type) {
    winston.log(type, _.reduce(_.slice(arguments, 1), function (list, value) {
      if (isError(value)) {
        list.push(value.stack);
      } else if (_.isObject(value)) {
        list.push(util.inspect(value, {showHidden: true, depth: 10}));
      } else {
        list.push(value + '');
      }

      return list;
    }, [chalk.blue(prefix + '::')]).join(' '));
  };
};

// for testing
module.exports.addELK = addELK;
