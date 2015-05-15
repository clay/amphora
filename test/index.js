'use strict';
var glob = require('glob'),
  _ = require('lodash'),
  tests = glob.sync(__dirname + '/../lib/**/*.test.js'),
  apiTests = glob.sync(__dirname + '/api/**/*.js');

_.map(tests, function (test) {
  require(test);
});

_.map(apiTests, function (test) {
  require(test);
});