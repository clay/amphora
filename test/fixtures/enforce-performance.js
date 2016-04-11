'use strict';

const _ = require('lodash'),
  chalk = require('chalk');

function enforceFastTest(obj) {
  let title,
    report,
    speed = obj.speed,
    duration = obj.duration;

  // unit tests should never take longer than 15 seconds (we shouldn't be testing IO, because that's not our code)
  if (duration && speed !== 'fast') {
    title = obj.title;
    while (obj.parent) {
      obj = obj.parent;
      title = obj.title + ' ' + title;
    }

    report = speed ? duration + 'ms ' + speed : duration + 'ms';

    report = speed === 'slow' ? chalk.red(report) : chalk.yellow(report);

    return chalk.dim([title, report].join(' '));
  }
}

function enforceFastTestSuite(obj) {
  let messages = [];

  messages = messages.concat(_.filter(_.map(obj.tests, enforceFastTest), _.identity));
  messages = messages.concat(_.flattenDeep(_.map(obj.suites, enforceFastTestSuite)));
  return messages;
}

function enforcePerformance(obj) {
  let messages;

  obj = obj._runnable;
  while (obj.parent) { obj = obj.parent; }

  messages = enforceFastTestSuite(obj);

  if (messages.length) {

    messages = ['\n\nPerformance Report:'].concat(messages);
    console.log(messages.join('\n'));
  }
}

module.exports = enforcePerformance;
