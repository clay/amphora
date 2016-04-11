'use strict';
const glob = require('glob'),
  _ = require('lodash'),
  chai = require('chai'),
  path = require('path'),
  tests = glob.sync([__dirname, '..', 'lib', '**', '*.test.js'].join(path.sep)),
  apiTests = glob.sync([__dirname, 'api', '**', '*.js'].join(path.sep));

// defaults for chai
chai.config.showDiff = true;
chai.config.truncateThreshold = 0;

// make sure the index file can be loaded at least
require('..');

_.each(tests, function (test) {
  require(test);
});

_.each(apiTests, function (test) {
  require(test);
});

after(function () {
  require('./fixtures/enforce-performance')(this);
});
