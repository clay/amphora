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
      data = { name: 'Manny', species: 'cat' };

    before(function () {
      return apiAccepts.beforeTesting(this, hostname, data);
    });

    beforeEach(function () {
      sandbox = sinon.sandbox.create();
      return apiAccepts.beforeEachComponentTest(sandbox,  hostname, data);
    });

    afterEach(function () {
      sandbox.restore();
    });

    describe('/components', function () {
      var path = this.title;
      acceptsJson(path, {}, 405, { allow:['get'], code: 405, message: 'Method DELETE not allowed' });
      acceptsHtml(path, {}, 405, { allow:['get'], code: 405, message: 'Method DELETE not allowed' });
    });

    describe('/components/:name', function () {
      var path = this.title;

      acceptsJson(path, {name: 'invalid'}, 404);
      acceptsJson(path, {name: 'valid'}, 200, data);
      acceptsJson(path, {name: 'missing'}, 404);

      acceptsHtml(path, {name: 'invalid'}, 404);
      acceptsHtml(path, {name: 'valid'}, 406);
      acceptsHtml(path, {name: 'missing'}, 406);
    });

    describe('/components/:name/instances', function () {
      var path = this.title;

      acceptsJson(path, {name: 'invalid'}, 404);
      acceptsJson(path, {name: 'valid'}, 405, { allow:['get'], code: 405, message: 'Method DELETE not allowed' });
      acceptsJson(path, {name: 'missing'}, 405, { allow:['get'], code: 405, message: 'Method DELETE not allowed' });

      acceptsHtml(path, {name: 'invalid'}, 404);
      acceptsHtml(path, {name: 'valid'}, 406);
      acceptsHtml(path, {name: 'missing'}, 406);
    });

    describe('/components/:name/instances/:id', function () {
      var path = this.title;

      acceptsJson(path, {name: 'invalid', id: 'valid'}, 404);
      acceptsJson(path, {name: 'valid', id: 'valid'}, 200, data);
      acceptsJson(path, {name: 'valid', id: 'missing'}, 404);

      acceptsHtml(path, {name: 'invalid', id: 'valid'}, 404);
      acceptsHtml(path, {name: 'valid', id: 'valid'}, 406);
      acceptsHtml(path, {name: 'valid', id: 'missing'}, 406);
    });
  });
});