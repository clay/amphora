'use strict';

const bluebird = require('bluebird');

module.exports = function () {
  return bluebird.resolve('exists');
};
