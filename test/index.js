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

_.each(apiTests, function (test) {
  if (_.includes(test, '/_components/get.js')) require(test);
  // console.log(test);
  // require(test);
});

// process.on('unhandledRejection', (reason, p) => {
//   console.log('Unhandled Rejection at:', p, 'reason:', reason);
//   // application specific logging, throwing an error, or other logic here
// });


// _.each(tests, function (test) {
//   // if (_.includes(test, '/responses.test')) require(test);
//   require(test);
// });

after(function () {
  require('./fixtures/enforce-performance')(this);
});
