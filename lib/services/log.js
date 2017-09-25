'use strict';

const clayLog = require('clay-log'),
  pkg = require('../../package.json');
var amphoraLogInstance;

// Initialize the logger
clayLog.init({
  name: 'amphora',
  meta: {
    amphoraVersion: pkg.version
  }
});

// Store the log instance
amphoraLogInstance = clayLog.getLogger();

module.exports.setup = function (meta = {}) {
  return clayLog.meta(meta, amphoraLogInstance);
}
