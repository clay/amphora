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
      pageData = {
        layout: 'localhost.example.com/_components/layout',
        center: 'localhost.example.com/_components/valid',
        side: ['localhost.example.com/_components/valid@valid']
      };

    beforeEach(function () {
      sandbox = sinon.sandbox.create();
    });

    afterEach(function () {
      sandbox.restore();
    });

    describe('/_pages', function () {
      const path = this.title;

      beforeEach(function () {
        return apiAccepts.beforeEachTest({ sandbox, hostname });
      });

      acceptsJson(path, {}, 405, { allow:['get', 'post'], code: 405, message: 'Method DELETE not allowed' });
      acceptsJsonBody(path, {}, {}, 405, { allow:['get', 'post'], code: 405, message: 'Method DELETE not allowed' });
      acceptsHtml(path, {}, 405, '405 Method DELETE not allowed');
    });

    describe('/_pages/:name', function () {
      const path = this.title;

      beforeEach(function () {
        return apiAccepts.beforeEachTest({ sandbox, hostname, pathsAndData: {
          '/_pages/valid': pageData
        }});
      });

      acceptsJson(path, {name: 'valid'}, 200, pageData);
      acceptsJson(path, {name: 'missing'}, 404, { message: 'Not Found', code: 404 });

      acceptsJsonBody(path, {name: 'valid'}, pageData, 200, pageData);
      acceptsJsonBody(path, {name: 'missing'}, pageData, 404, { message: 'Not Found', code: 404 });

      acceptsHtml(path, {name: 'valid'}, 406, '406 text/html not acceptable');
      acceptsHtml(path, {name: 'missing'}, 406, '406 text/html not acceptable');
    });

    describe('/_pages/:name@:version', function () {
      const path = this.title;

      beforeEach(function () {
        return apiAccepts.beforeEachTest({ sandbox, hostname, pathsAndData: {
          '/_pages/valid@valid': pageData
        }});
      });

      acceptsJson(path, {name: 'valid', version: 'valid'}, 200, pageData);
      acceptsJson(path, {name: 'valid', version: 'missing'}, 404, { message: 'Not Found', code: 404 });

      acceptsJsonBody(path, {name: 'valid', version: 'valid'}, pageData, 200, pageData);
      acceptsJsonBody(path, {name: 'valid', version: 'missing'}, pageData, 404, { message: 'Not Found', code: 404 });

      acceptsHtml(path, {name: 'valid', version: 'valid'}, 406, '406 text/html not acceptable');
      acceptsHtml(path, {name: 'valid', version: 'missing'}, 406, '406 text/html not acceptable');
    });
  });
});
