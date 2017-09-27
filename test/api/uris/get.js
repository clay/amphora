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
      acceptsText = apiAccepts.acceptsText(_.camelCase(filename)),
      data = 'mock uri';

    beforeEach(function () {
      sandbox = sinon.sandbox.create();
    });

    afterEach(function () {
      sandbox.restore();
    });

    describe('/_uris', function () {
      const path = this.title;

      beforeEach(function () {
        return apiAccepts.beforeEachTest({ sandbox, hostname, pathsAndData: { '/_uris/valid': data }});
      });

      acceptsJson(path, {}, 200, '["localhost.example.com/_uris/valid"]');
      acceptsHtml(path, {}, 406, '406 text/html not acceptable');
      acceptsText(path, {}, 406, '406 text/plain not acceptable');
    });

    describe('/_uris/:name', function () {
      const path = this.title;

      beforeEach(function () {
        return apiAccepts.beforeEachTest({ sandbox, hostname, pathsAndData: { '/_uris/valid': data }});
      });

      acceptsJson(path, {name: 'invalid'}, 406, { message: 'application/json not acceptable', code: 406, accept: ['text/plain'] });
      acceptsJson(path, {name: 'valid'}, 406, { message: 'application/json not acceptable', code: 406, accept: ['text/plain'] });
      acceptsJson(path, {name: 'missing'}, 406, { message: 'application/json not acceptable', code: 406, accept: ['text/plain'] });

      acceptsHtml(path, {name: 'invalid'}, 406, '406 text/html not acceptable');
      acceptsHtml(path, {name: 'valid'}, 406, '406 text/html not acceptable');
      acceptsHtml(path, {name: 'missing'}, 406, '406 text/html not acceptable');

      acceptsText(path, {name: 'invalid'}, 404, '404 Not Found');
      acceptsText(path, {name: 'valid'}, 200, data);
      acceptsText(path, {name: 'missing'}, 404, '404 Not Found');

      // deny trailing slashes
      acceptsText(path + '/', {name: 'valid'}, 400, '400 Trailing slash on RESTful id in URL is not acceptable');
    });
  });
});
