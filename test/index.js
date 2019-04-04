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
// The DB service gets a little borked because of how we have
// to use it right now. What we need to do is write an in-memory
// store purely for testing amphora. This will come later, but
// right now the db tests need to run first
require('../lib/services/db.test');

_.each(apiTests, test => {
  require(test);
});

_.each(tests, test => {
  require(test);
});

after(function () {
  require('./fixtures/enforce-performance')(this);
});
