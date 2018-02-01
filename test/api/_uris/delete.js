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
      acceptsTextBody = apiAccepts.acceptsTextBody(_.camelCase(filename)),
      acceptsText = apiAccepts.acceptsText(_.camelCase(filename)),
      data = 'mock data';

    beforeEach(function () {
      sandbox = sinon.sandbox.create();
    });

    afterEach(function () {
      sandbox.restore();
    });

    describe('/_uris', function () {
      const path = this.title;

      beforeEach(function () {
        return apiAccepts.beforeEachTest({ sandbox, hostname });
      });

      acceptsJson(path, {}, 405, { allow:['get'], code: 405, message: 'Method DELETE not allowed' });
      acceptsJsonBody(path, {}, {}, 405, { allow:['get'], code: 405, message: 'Method DELETE not allowed' });
      acceptsText(path, {}, 405, '405 Method DELETE not allowed');
    });

    describe('/_uris/:name', function () {
      const path = this.title;

      beforeEach(function () {
        return apiAccepts.beforeEachTest({ sandbox, hostname, pathsAndData: {
          '/_uris/valid': data
        }});
      });

      acceptsJson(path, {name: 'valid'}, 406, { message: 'application/json not acceptable', code: 406, accept: ['text/plain'] });
      acceptsJson(path, {name: 'missing'}, 406, { message: 'application/json not acceptable', code: 406, accept: ['text/plain'] });

      acceptsText(path, {name: 'valid'}, 200, data);
      acceptsText(path, {name: 'missing'}, 404, '404 Not Found');

      acceptsTextBody(path, {name: 'valid'}, data, 200, data);
      acceptsTextBody(path, {name: 'missing'}, data, 404, '404 Not Found');
    });
  });
});
