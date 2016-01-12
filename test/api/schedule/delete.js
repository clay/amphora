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
      acceptsJsonBody = apiAccepts.acceptsJsonBody(_.camelCase(filename)),
      acceptsHtml = apiAccepts.acceptsHtml(_.camelCase(filename)),
      //componentData = {},
      scheduleData = { at: new Date('2015-01-01').getTime(), publish: 'http://localhost.example.com/pages/valid' };
    //layoutData = {},
    //pageData = {};

    beforeEach(function () {
      sandbox = sinon.sandbox.create();
      sandbox.useFakeTimers();
    });

    afterEach(function () {
      sandbox.restore();
    });

    describe('/schedule', function () {
      var path = this.title;

      beforeEach(function () {
        return apiAccepts.beforeEachTest({ sandbox: sandbox, hostname: hostname });
      });

      acceptsJson(path, {}, 405, { allow:['get', 'post'], code: 405, message: 'Method DELETE not allowed' });
      acceptsJsonBody(path, {}, {}, 405, { allow:['get', 'post'], code: 405, message: 'Method DELETE not allowed' });
      acceptsHtml(path, {}, 405, '405 Method DELETE not allowed');
    });

    describe('/schedule/:name', function () {
      var path = this.title;

      beforeEach(function () {
        return apiAccepts.beforeEachTest({ sandbox: sandbox, hostname: hostname, pathsAndData: {
          '/schedule/valid': scheduleData
        }});
      });

      acceptsJson(path, {name: 'valid'}, 200, scheduleData);
      acceptsJson(path, {name: 'missing'}, 404, { message: 'Not Found', code: 404 });

      acceptsJsonBody(path, {name: 'valid'}, scheduleData, 200, scheduleData);
      acceptsJsonBody(path, {name: 'missing'}, scheduleData, 404, { message: 'Not Found', code: 404 });

      acceptsHtml(path, {name: 'valid'}, 406, '406 text/html not acceptable');
      acceptsHtml(path, {name: 'missing'}, 406, '406 text/html not acceptable');
    });
  });
});