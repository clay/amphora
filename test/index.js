'use strict';
var glob = require('glob'),
  _ = require('lodash'),
  tests = glob.sync(__dirname + '/../services/*.test.js');

_.map(tests, function (test) {
  require(test);
});