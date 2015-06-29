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
      expectDataPlusRef = apiAccepts.expectDataPlusRef,
      data = { name: 'Manny', species: 'cat' };

    beforeEach(function () {
      sandbox = sinon.sandbox.create();
      return apiAccepts.beforeEachComponentTest(sandbox, hostname, data);
    });

    afterEach(function () {
      sandbox.restore();
    });

    describe('/components', function () {
      var path = this.title;

      acceptsJson(path, {}, 405);
      acceptsHtml(path, {}, 405);
    });

    describe('/components/:name', function () {
      var path = this.title;

      acceptsJson(path, {name: 'invalid'}, 404, { message: 'Not Found', code: 404 });
      acceptsJson(path, {name: 'valid'}, 405, { allow: ['get', 'put', 'delete'], code: 405, message: 'Method POST not allowed' });
      acceptsJson(path, {name: 'missing'}, 405, { allow: ['get', 'put', 'delete'], code: 405, message: 'Method POST not allowed' });

      acceptsHtml(path, {name: 'invalid'}, 404, '404 Not Found');
      acceptsHtml(path, {name: 'valid'}, 406, '406 text/html not acceptable');
      acceptsHtml(path, {name: 'missing'}, 406, '406 text/html not acceptable');
    });

    describe('/components/:name/schema', function () {
      var path = this.title;

      acceptsJson(path, {name: 'invalid'}, 404, { message: 'Not Found', code: 404 });
      acceptsJson(path, {name: 'valid'}, 405, { allow: ['get'], code: 405, message: 'Method POST not allowed' });
      acceptsJson(path, {name: 'missing'}, 405, { allow: ['get'], code: 405, message: 'Method POST not allowed' });

      acceptsHtml(path, {name: 'invalid'}, 404, '404 Not Found');
      acceptsHtml(path, {name: 'valid'}, 405, '405 Method POST not allowed');
      acceptsHtml(path, {name: 'missing'}, 405, '405 Method POST not allowed');
    });

    describe('/components/:name/instances', function () {
      var path = this.title;

      acceptsJson(path, {name: 'invalid'}, 404, { message: 'Not Found', code: 404 });
      acceptsJson(path, {name: 'valid'}, 200, expectDataPlusRef({}));
      acceptsJson(path, {name: 'missing'}, 200, expectDataPlusRef({}));

      acceptsJsonBody(path, {name: 'invalid'}, {}, 404, { message: 'Not Found', code: 404 });
      acceptsJsonBody(path, {name: 'valid'}, data, 200, expectDataPlusRef(data));
      acceptsJsonBody(path, {name: 'missing'}, data, 200, expectDataPlusRef(data));

      acceptsHtml(path, {name: 'invalid'}, 404, '404 Not Found');
      acceptsHtml(path, {name: 'valid'}, 406, '406 text/html not acceptable');
      acceptsHtml(path, {name: 'missing'}, 406, '406 text/html not acceptable');
    });

    describe('/components/:name/instances/:id', function () {
      var path = this.title;

      acceptsJson(path, {name: 'invalid', id: 'valid'}, 404, { message: 'Not Found', code: 404 });
      acceptsJson(path, {name: 'valid', id: 'valid'}, 405, { allow: ['get', 'put', 'delete'], code: 405, message: 'Method POST not allowed' });
      acceptsJson(path, {name: 'valid', id: 'missing'}, 405, { allow: ['get', 'put', 'delete'], code: 405, message: 'Method POST not allowed' });

      acceptsHtml(path, {name: 'invalid', id: 'valid'}, 404, '404 Not Found');
      acceptsHtml(path, {name: 'valid', id: 'valid'}, 406, '406 text/html not acceptable');
      acceptsHtml(path, {name: 'valid', id: 'missing'}, 406, '406 text/html not acceptable');
    });
  });
});
