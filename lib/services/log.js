'use strict';

const clayLog = require('clay-log'),
  pkg = require('../../package.json');

// Initialize the logger
clayLog.init({
  name: 'amphora',
  prettyPrint: true,
  meta: {
    amphoraVersion: pkg.version
  }
});

module.exports.withStandardPrefix = function (dirname) {
  return clayLog.meta({ dirname });
}
