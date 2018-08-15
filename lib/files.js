'use strict';

const _ = require('lodash'),
  amphoraFs = require('amphora-fs'),
  NON_MEMOIZED_FNS = ['getComponentPath', 'getLayoutPath', 'fileExists'];

// Assign each amphora-fs function to the module's exports,
// but memoize a couple for amphora use
for (const fn in amphoraFs) {
  if (NON_MEMOIZED_FNS.includes(fn)) {
    module.exports[fn] = _.memoize(amphoraFs[fn]);
  } else {
    module.exports[fn] = amphoraFs[fn];
  }
}
