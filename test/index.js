'use strict';
var glob = require('glob'),
  _ = require('lodash'),
  tests = glob.sync(__dirname + '/../lib/**/*.test.js'),
  apiTests = glob.sync(__dirname + '/api/**/*.js');

before(function () {
  //any call greater than this is unacceptable because:
  // - the DB is in memory.
  this.slow(30);

  //just no
  this.timeout(40);
});

_.map(tests, function (test) {
  require(test);
});

_.map(apiTests, function (test) {
  require(test);
});

after(function () {
  require('./fixtures/enforce-performance')(this);
});