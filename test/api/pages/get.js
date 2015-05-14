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

    beforeEach(function () {
      sandbox = sinon.sandbox.create();
      return apiAccepts.beforeEachPageTest(sandbox,  hostname, data);
    });

    afterEach(function () {
      sandbox.restore();
    });

    describe('/pages', function () {
      var path = this.title;
      acceptsJson(path, {}, 200, '["/pages/valid"]');
      acceptsHtml(path, {}, 406);
    });

    describe('/pages/:name', function () {
      var path = this.title;

      acceptsJson(path, {name: 'invalid'}, 404);
      acceptsJson(path, {name: 'valid'}, 200, data);
      acceptsJson(path, {name: 'missing'}, 404);

      acceptsHtml(path, {name: 'invalid'}, 406);
      acceptsHtml(path, {name: 'valid'}, 406);
      acceptsHtml(path, {name: 'missing'}, 406);
    });

    describe('/pages/:name@:version', function () {
      var path = this.title;

      acceptsJson(path, {name: 'invalid', version: 'missing'}, 404);
      acceptsJson(path, {name: 'valid', version: 'missing'}, 404);
      acceptsJson(path, {name: 'missing', version: 'missing'}, 404);

      acceptsHtml(path, {name: 'invalid', version: 'missing'}, 406);
      acceptsHtml(path, {name: 'valid', version: 'missing'}, 406);
      acceptsHtml(path, {name: 'missing', version: 'missing'}, 406);
    });
  });
});