'use strict';

var _ = require('lodash'),
  apiAccepts = require('../../fixtures/api-accepts'),
  endpointName = _.startCase(__dirname.split('/').pop()),
  filename = _.startCase(__filename.split('/').pop().split('.').shift()),
  sinon = require('sinon');

describe(endpointName, function () {
  describe(filename, function () {
    var sandbox,
      hostname = 'localhost.example.com',
      acceptsJson = apiAccepts.acceptsJson(_.camelCase(filename)),
      acceptsHtml = apiAccepts.acceptsHtml(_.camelCase(filename)),
      componentData = {},
      scheduleData = {},
      layoutData = {},
      pageData = {};

    beforeEach(function () {
      sandbox = sinon.sandbox.create();
      return apiAccepts.beforeEachScheduleTest(sandbox, hostname, pageData, layoutData, componentData, scheduleData);
    });

    afterEach(function () {
      sandbox.restore();
    });

    describe('/schedule', function () {
      var path = this.title;

      acceptsJson(path, {}, 200, '[{"key":"localhost.example.com/schedule/valid","value":"{}"}]');
      acceptsHtml(path, {}, 406);
    });

    describe('/schedule/:name', function () {
      var path = this.title;

      acceptsJson(path, {name: 'valid'}, 200, pageData);
      acceptsJson(path, {name: 'missing'}, 404, { message: 'Not Found', code: 404 });
      acceptsHtml(path, {name: 'valid'}, 406, '406 text/html not acceptable');
      acceptsHtml(path, {name: 'missing'}, 406, '406 text/html not acceptable');
    });
  });
});