/**
 * Shared by all HTTP methods in the current API.
 */

'use strict';

var apiAccepts = require('../../fixtures/api-accepts');

/**
 * Repopulate the DB before each test.
 * @param sandbox
 * @param hostname
 * @param data
 * @returns {Promise}
 */
module.exports.beforeEachTest = function (sandbox, hostname, data) {
  return apiAccepts.beforeEachTest({
    sandbox: sandbox,
    hostname: hostname,
    pathsAndData: {
      '/components/valid': data,
      '/components/valid/instances/valid': data,
      '/components/valid/instances/valid@valid': data,
      '/pages/valid': data,
      '/pages/valid@valid': data,
      '/uris/valid': data
    }
  });
};
