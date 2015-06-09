/**
 * Shared by all HTTP methods in the current API.
 */

'use strict';

var apiAccepts = require('../../fixtures/api-accepts');

/**
 * Repopulate the DB before each test.
 * @param sandbox
 * @param hostname
 * @param pageData
 * @param layoutData
 * @param componentData
 * @returns {Promise}
 */
module.exports.beforeEachTest = function (sandbox, hostname, pageData, layoutData, componentData) {
  return apiAccepts.beforeEachTest({
    sandbox: sandbox,
    hostname: hostname,
    pathsAndData: {
      '/components/layout': layoutData,
      '/components/layout@valid': layoutData,
      '/components/valid': {deep: {_ref: '/components/validDeep'}},
      '/components/valid@valid': {deep: {_ref: '/components/validDeep'}},
      '/components/validDeep': componentData,
      '/components/validDeep@valid': componentData,
      '/pages/valid': pageData,
      '/pages/valid@valid': pageData
    }
  });
};
