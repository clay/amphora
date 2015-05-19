'use strict';

var _ = require('lodash'),
  chalk = require('chalk');

function enforceFastTest(obj) {
  var title,
    speed = obj.speed,
    duration = obj.duration;

  // unit tests should never take longer than 15 seconds (we shouldn't be testing IO, because that's not our code)
  if (duration > 15 || speed !== 'fast') {
    title = obj.title;
    while (obj.parent) {
      obj = obj.parent;
      title = obj.title + ' ' + title;
    }

    if (speed === 'slow') {
      return chalk.dim([title, chalk.red(duration + 'ms ' + speed)].join(' '));
    } else {
      return chalk.dim([title, chalk.yellow(duration + 'ms ' + speed)].join(' '));
    }
  }
}

function enforceFastTestSuite(obj) {
  var messages = [];
  messages = messages.concat(_.filter(_.map(obj.tests, enforceFastTest), _.identity));
  messages = messages.concat(_.flattenDeep(_.map(obj.suites, enforceFastTestSuite)));
  return messages;
}

function enforcePerformance(obj) {
  var messages;

  obj = obj._runnable;
  while (obj.parent) { obj = obj.parent; }

  messages = enforceFastTestSuite(obj);

  if (messages.length) {

    messages = ['\n\nPerformance Report:'].concat(messages);
    console.log(messages.join('\n'));
  }
}

module.exports = enforcePerformance;