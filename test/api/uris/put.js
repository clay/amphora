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
      acceptsTextBody = apiAccepts.acceptsTextBody(_.camelCase(filename)),
      acceptsText = apiAccepts.acceptsText(_.camelCase(filename)),
      data = 'mock data';

    beforeEach(function () {
      sandbox = sinon.sandbox.create();
      return apiAccepts.beforeEachUriTest(sandbox, hostname, data);
    });

    afterEach(function () {
      sandbox.restore();
    });

    describe('/uris', function () {
      var path = this.title;

      acceptsJson(path, {}, 405, { allow: ['get'], code: 405, message: 'Method PUT not allowed' });
      acceptsJsonBody(path, {}, {}, 405, { allow: ['get'], code: 405, message: 'Method PUT not allowed' });
      acceptsHtml(path, {}, 405, '405 Method PUT not allowed');
      acceptsText(path, {}, 405, 'Method Not Allowed');
    });

    describe('/uris/:name', function () {
      var path = this.title;

      acceptsJson(path, {name: 'valid'}, 406, { message: 'application/json not acceptable', code: 406, accept: ['text/plain'] });
      acceptsJson(path, {name: 'missing'}, 406, { message: 'application/json not acceptable', code: 406, accept: ['text/plain'] });

      acceptsHtml(path, {name: 'valid'}, 406, '406 text/html not acceptable');
      acceptsHtml(path, {name: 'missing'}, 406, '406 text/html not acceptable');

      acceptsText(path, {name: 'valid'}, 200, '');
      acceptsText(path, {name: 'missing'}, 200, '');

      acceptsTextBody(path, {name: 'valid'}, data, 200, data);
      acceptsTextBody(path, {name: 'missing'}, data, 200, data);
    });
  });
});
