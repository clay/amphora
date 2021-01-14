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

// when we are testing to make sure errors are being thrown,
// we don't want to log errors because it makes it seem like the test is failing
process.env.LOG = 'silent';

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
