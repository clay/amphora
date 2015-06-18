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
      acceptsText = apiAccepts.acceptsText(_.camelCase(filename)),
      data = 'mock uri';

    beforeEach(function () {
      sandbox = sinon.sandbox.create();
      return apiAccepts.beforeEachUriTest(sandbox,  hostname, data);
    });

    afterEach(function () {
      sandbox.restore();
    });

    describe('/uris', function () {
      var path = this.title;
      acceptsJson(path, {}, 200, '["/uris/valid"]');
      acceptsHtml(path, {}, 406, '406 text/html not acceptable');
      acceptsText(path, {}, 406, 'Not Acceptable');
    });

    describe('/uris/:name', function () {
      var path = this.title;

      acceptsJson(path, {name: 'invalid'}, 406, { message: 'application/json not acceptable', code: 406, accept: ['text/plain'] });
      acceptsJson(path, {name: 'valid'}, 406, { message: 'application/json not acceptable', code: 406, accept: ['text/plain'] });
      acceptsJson(path, {name: 'missing'}, 406, { message: 'application/json not acceptable', code: 406, accept: ['text/plain'] });

      acceptsHtml(path, {name: 'invalid'}, 406, '406 text/html not acceptable');
      acceptsHtml(path, {name: 'valid'}, 406, '406 text/html not acceptable');
      acceptsHtml(path, {name: 'missing'}, 406, '406 text/html not acceptable');

      acceptsText(path, {name: 'invalid'}, 404, 'Not Found');
      acceptsText(path, {name: 'valid'}, 200, data);
      acceptsText(path, {name: 'missing'}, 404, 'Not Found');
    });
  });
});