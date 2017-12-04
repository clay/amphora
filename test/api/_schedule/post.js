'use strict';

const _ = require('lodash'),
  apiAccepts = require('../../fixtures/api-accepts'),
  endpointName = _.startCase(__dirname.split('/').pop()),
  filename = _.startCase(__filename.split('/').pop().split('.').shift()),
  sinon = require('sinon');

describe(endpointName, function () {
  describe(filename, function () {
    let sandbox,
      hostname = 'localhost.example.com',
      acceptsJson = apiAccepts.acceptsJson(_.camelCase(filename)),
      acceptsJsonBody = apiAccepts.acceptsJsonBody(_.camelCase(filename)),
      acceptsHtml = apiAccepts.acceptsHtml(_.camelCase(filename)),
      time = new Date('2015-01-01').getTime(),
      pageData = {};

    beforeEach(function () {
      sandbox = sinon.sandbox.create();
      sandbox.useFakeTimers();
    });

    afterEach(function () {
      sandbox.restore();
    });

    describe('/_schedule', function () {
      const path = this.title;

      beforeEach(function () {
        return apiAccepts.beforeEachTest({ sandbox, hostname });
      });

      acceptsJson(path, {}, 400, { message: 'Missing "at" property as number.', code: 400 });
      acceptsHtml(path, {}, 406, '406 text/html not acceptable');

      acceptsJsonBody(path, {}, {}, 400, { message: 'Missing "at" property as number.', code: 400 });
      acceptsJsonBody(path, {}, {at: time}, 400, { message: 'Missing "publish" property as valid url.', code: 400 });
      acceptsJsonBody(path, {}, {at: time, publish: 'http://abc'}, 201, { _ref: 'example/_schedule/YWJj', at: time, publish: 'http://abc' });
    });

    describe('/_schedule/:name', function () {
      const path = this.title;

      beforeEach(function () {
        return apiAccepts.beforeEachTest({ sandbox, hostname });
      });

      acceptsJson(path, {name: 'valid'}, 405, { allow:['get', 'delete'], code: 405, message: 'Method POST not allowed' });
      acceptsJsonBody(path, {name: 'valid'}, pageData, 405, { allow:['get', 'delete'], code: 405, message: 'Method POST not allowed' });
      acceptsHtml(path, {name: 'valid'}, 405, '405 Method POST not allowed');
    });
  });
});
