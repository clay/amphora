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
      acceptsHtml = apiAccepts.acceptsHtml(_.camelCase(filename)),
      data = { name: 'Manny', species: 'cat' };

    before(function () {
      sandbox = sinon.sandbox.create();
      this.timeout(500);
      return apiAccepts.beforeTesting(this, {
        hostname,
        data,
        sandbox
      }).then(function () {
        sandbox.restore();
      });
    });

    beforeEach(function () {
      sandbox = sinon.sandbox.create();
    });

    afterEach(function () {
      sandbox.restore();
    });

    describe('/_components', function () {
      const path = this.title;

      beforeEach(function () {
        return apiAccepts.beforeEachTest({ sandbox, hostname });
      });

      acceptsJson(path, {}, 405, { allow:['get'], code: 405, message: 'Method DELETE not allowed' });
      acceptsHtml(path, {}, 405, '405 Method DELETE not allowed');
    });

    describe('/_components/:name', function () {
      const path = this.title;

      beforeEach(function () {
        return apiAccepts.beforeEachTest({ sandbox, hostname, pathsAndData: {
          '/_components/valid': data
        }});
      });

      acceptsJson(path, {name: 'invalid'}, 404, { message: 'Not Found', code: 404 });
      acceptsJson(path, {name: 'valid'}, 200, data);
      acceptsJson(path, {name: 'missing'}, 404, { message: 'Not Found', code: 404 });

      acceptsHtml(path, {name: 'invalid'}, 404, '404 Not Found');
      acceptsHtml(path, {name: 'valid'}, 406, '406 text/html not acceptable');
      acceptsHtml(path, {name: 'missing'}, 406, '406 text/html not acceptable');
    });

    describe('/_components/:name/schema', function () {
      const path = this.title;

      beforeEach(function () {
        return apiAccepts.beforeEachTest({ sandbox, hostname });
      });

      acceptsJson(path, {name: 'invalid'}, 404, { message: 'Not Found', code: 404 });
      acceptsJson(path, {name: 'valid'}, 405, { allow:['get'], code: 405, message: 'Method DELETE not allowed' });
      acceptsJson(path, {name: 'missing'}, 405, { allow:['get'], code: 405, message: 'Method DELETE not allowed' });

      acceptsHtml(path, {name: 'invalid'}, 404, '404 Not Found');
      acceptsHtml(path, {name: 'valid'}, 405, '405 Method DELETE not allowed');
      acceptsHtml(path, {name: 'missing'}, 405, '405 Method DELETE not allowed');
    });

    describe('/_components/:name/instances', function () {
      const path = this.title;

      beforeEach(function () {
        return apiAccepts.beforeEachTest({ sandbox, hostname });
      });

      acceptsJson(path, {name: 'invalid'}, 404, { message: 'Not Found', code: 404 });
      acceptsJson(path, {name: 'valid'}, 405, { allow:['get', 'post'], code: 405, message: 'Method DELETE not allowed' });
      acceptsJson(path, {name: 'missing'}, 405, { allow:['get', 'post'], code: 405, message: 'Method DELETE not allowed' });

      acceptsHtml(path, {name: 'invalid'}, 404, '404 Not Found');
      acceptsHtml(path, {name: 'valid'}, 406, '406 text/html not acceptable');
      acceptsHtml(path, {name: 'missing'}, 406, '406 text/html not acceptable');
    });

    describe('/_components/:name/instances/:id', function () {
      const path = this.title;

      beforeEach(function () {
        return apiAccepts.beforeEachTest({ sandbox, hostname, pathsAndData: {
          '/_components/valid/instances/valid': data
        }});
      });

      acceptsJson(path, {name: 'invalid', id: 'valid'}, 404, { message: 'Not Found', code: 404 });
      acceptsJson(path, {name: 'valid', id: 'valid'}, 200, data);
      acceptsJson(path, {name: 'valid', id: 'missing'}, 404, { message: 'Not Found', code: 404 });

      acceptsHtml(path, {name: 'invalid', id: 'valid'}, 404, '404 Not Found');
      acceptsHtml(path, {name: 'valid', id: 'valid'}, 406, '406 text/html not acceptable');
      acceptsHtml(path, {name: 'valid', id: 'missing'}, 406, '406 text/html not acceptable');
    });

    describe('/_components/:name/instances/:id@:version', function () {
      const path = this.title;

      beforeEach(function () {
        return apiAccepts.beforeEachTest({ sandbox, hostname, pathsAndData: {
          '/_components/valid/instances/valid@valid': data
        }});
      });

      acceptsJson(path, {name: 'invalid', id: 'valid', version: 'valid'}, 404, { message: 'Not Found', code: 404 });
      acceptsJson(path, {name: 'valid', id: 'valid', version: 'valid'}, 200, data);
      acceptsJson(path, {name: 'valid', id: 'missing', version: 'valid'}, 404, { message: 'Not Found', code: 404 });

      acceptsHtml(path, {name: 'invalid', id: 'valid', version: 'valid'}, 404, '404 Not Found');
      acceptsHtml(path, {name: 'valid', id: 'valid', version: 'valid'}, 406, '406 text/html not acceptable');
      acceptsHtml(path, {name: 'valid', id: 'missing', version: 'valid'}, 406, '406 text/html not acceptable');
    });
  });
});
