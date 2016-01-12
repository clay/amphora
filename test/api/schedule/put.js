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
      componentData = {},
      scheduleData = { at: new Date('2015-01-01').getTime() },
      layoutData = {},
      pageData = {};

    beforeEach(function () {
      sandbox = sinon.sandbox.create();
      sandbox.useFakeTimers();
      return apiAccepts.beforeEachTest({
        sandbox: sandbox,
        hostname: hostname,
        pathsAndData: {
          '/components/layout': layoutData,
          '/components/valid': componentData,
          '/pages/valid': pageData,
          '/pages/valid@scheduled': _.assign({_ref: hostname + '/schedule/valid'}, scheduleData),
          '/schedule/valid': scheduleData
        }
      });
    });

    afterEach(function () {
      sandbox.restore();
    });

    describe('/schedule', function () {
      var path = this.title;

      acceptsJson(path, {}, 405, { allow:['get', 'post'], code: 405, message: 'Method PUT not allowed' });
      acceptsJsonBody(path, {}, {}, 405, { allow:['get', 'post'], code: 405, message: 'Method PUT not allowed' });
      acceptsHtml(path, {}, 405, '405 Method PUT not allowed');
    });

    describe('/schedule/:name', function () {
      var path = this.title;

      acceptsJson(path, {}, 405, { allow:['get', 'delete'], code: 405, message: 'Method PUT not allowed' });
      acceptsJsonBody(path, {}, {}, 405, { allow:['get', 'delete'], code: 405, message: 'Method PUT not allowed' });
      acceptsHtml(path, {}, 405, '405 Method PUT not allowed');
    });
  });
});