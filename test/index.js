'use strict';
var glob = require('glob'),
  _ = require('lodash'),
  chai = require('chai'),
  path = require('path'),
  tests = glob.sync(path.resolve(__dirname, '/../lib/**/*.test.js')),
  apiTests = glob.sync(path.resolve(__dirname, '/api/**/*.js'));

// defaults for chai
chai.config.showDiff = true;
chai.config.truncateThreshold = 0;


_.map(tests, function (test) {
  require(test);
});

_.map(apiTests, function (test) {
  require(test);
});

after(function () {
  require('./fixtures/enforce-performance')(this);
});
