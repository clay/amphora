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

      acceptsJson(path, {}, 405, { allow:['get'], code: 405, message: 'Method PUT not allowed' });
      acceptsJsonBody(path, {}, {}, 405, { allow:['get'], code: 405, message: 'Method PUT not allowed' });
      acceptsHtml(path, {}, 405, '405 Method PUT not allowed');
      acceptsText(path, {}, 405, '405 Method PUT not allowed');
    });

    describe('/_uris/:name', function () {
      const path = this.title;

      beforeEach(function () {
        return apiAccepts.beforeEachTest({ sandbox, hostname });
      });

      acceptsJson(path, {name: 'valid'}, 406, { message: 'application/json not acceptable', code: 406, accept: ['text/plain'] });
      acceptsJson(path, {name: 'missing'}, 406, { message: 'application/json not acceptable', code: 406, accept: ['text/plain'] });

      acceptsHtml(path, {name: 'valid'}, 406, '406 text/html not acceptable');
      acceptsHtml(path, {name: 'missing'}, 406, '406 text/html not acceptable');

      acceptsText(path, {name: 'valid'}, 200, '');
      acceptsText(path, {name: 'missing'}, 200, '');

      acceptsTextBody(path, {name: 'valid'}, data, 200, data);
      acceptsTextBody(path, {name: 'missing'}, data, 200, data);
      // propagating versions shouldn't be here. Only published things can be public, so all uris are assumed to be @published already
      acceptsTextBody(path, {name: 'valid'}, 'domain/_pages/test@published', 400, '400 Cannot point uri at propagating version, such as @published');

      // deny uris pointing to themselves
      acceptsTextBody(path, {name: 'valid'}, 'localhost.example.com/_uris/valid', 400, '400 Cannot point uri at itself');
      // deny uris with quotes
      acceptsTextBody(path, {name: 'valid'}, '"localhost.example.com/_uris/valid"', 400, '400 Destination cannot contain quotes');
      // deny trailing slashes
      acceptsTextBody(path + '/', {name: 'valid'}, '"localhost.example.com/_uris/valid"', 400, '400 Trailing slash on RESTful id in URL is not acceptable');
    });
  });
});
