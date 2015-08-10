'use strict';

var _ = require('lodash'),
  apiAccepts = require('../../fixtures/api-accepts'),
  endpointName = _.startCase(__dirname.split('/').pop()),
  filename = _.startCase(__filename.split('/').pop().split('.').shift()),
  replaceVersion = require('../../../lib/services/references').replaceVersion,
  sinon = require('sinon'),
  expect = require('chai').expect;

describe(endpointName, function () {
  describe(filename, function () {
    var sandbox,
      hostname = 'localhost.example.com',
      acceptsJson = apiAccepts.acceptsJson(_.camelCase(filename)),
      acceptsJsonBody = apiAccepts.acceptsJsonBody(_.camelCase(filename)),
      acceptsHtml = apiAccepts.acceptsHtml(_.camelCase(filename)),
      pageData = {
        layout: 'localhost.example.com/components/layout',
        center: 'localhost.example.com/components/valid',
        side: ['localhost.example.com/components/valid@valid']
      },
      deepData = { deep: {_ref: 'localhost.example.com/components/validDeep'} },
      layoutData = { someArea: ['center'] },
      componentData = { name: 'Manny', species: 'cat' };

    beforeEach(function () {
      sandbox = sinon.sandbox.create();
      return apiAccepts.beforeEachPageTest(sandbox,  hostname, pageData, layoutData, deepData, componentData);
    });

    afterEach(function () {
      sandbox.restore();
    });

    describe('/pages', function () {
      var path = this.title;

      acceptsJson(path, {}, 400, { message: 'Data missing layout reference.', code: 400 });
      acceptsJsonBody(path, {}, {}, 400, { message: 'Data missing layout reference.', code: 400 });
      acceptsJsonBody(path, {}, pageData, 201, function (result) {
        var body = result.body;
        expect(body.center).to.match(/^localhost.example.com\/components\/valid\/instances\/.+/);
        expect(body.side[0]).to.match(/^localhost.example.com\/components\/valid\/instances\/.+/);
        expect(body.layout).to.equal(pageData.layout);
        expect(body._ref).to.match(/^localhost.example.com\/pages\/.+/);
      });
      acceptsHtml(path, {}, 406, '406 text/html not acceptable');
    });

    describe('/pages/:name', function () {
      var path = this.title;

      acceptsJson(path, {name: 'valid'}, 405, { allow:['get', 'put'], code: 405, message: 'Method POST not allowed' });
      acceptsJsonBody(path, {name: 'valid'}, pageData, 405, { allow:['get', 'put'], code: 405, message: 'Method POST not allowed' });
      acceptsHtml(path, {name: 'valid'}, 405, '405 Method POST not allowed');
    });

    describe('/pages/:name@:version', function () {
      var path = this.title,
        version = 'def';

      acceptsJson(path, {name: 'valid', version: version}, 405, { allow:['get', 'put'], code: 405, message: 'Method POST not allowed' });
      acceptsJsonBody(path, {name: 'valid', version: version}, pageData, 405, { allow:['get', 'put'], code: 405, message: 'Method POST not allowed' });
      acceptsHtml(path, {name: 'valid', version: version}, 405, '405 Method POST not allowed');
    });
  });
});