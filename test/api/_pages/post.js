'use strict';

const _ = require('lodash'),
  apiAccepts = require('../../fixtures/api-accepts'),
  endpointName = _.startCase(__dirname.split('/').pop()),
  filename = _.startCase(__filename.split('/').pop().split('.').shift()),
  sinon = require('sinon'),
  expect = require('chai').expect;

describe(endpointName, function () {
  describe(filename, function () {
    let sandbox,
      hostname = 'localhost.example.com',
      acceptsJson = apiAccepts.acceptsJson(_.camelCase(filename)),
      acceptsJsonBody = apiAccepts.acceptsJsonBody(_.camelCase(filename)),
      acceptsHtml = apiAccepts.acceptsHtml(_.camelCase(filename)),
      pageData = {
        layout: 'localhost.example.com/_layouts/layout',
        center: 'localhost.example.com/_components/valid',
        side: ['localhost.example.com/_components/valid@valid']
      },
      deepData = { deep: {_ref: 'localhost.example.com/_components/validDeep'} },
      layoutData = { someArea: ['center'] },
      data = {
        page: pageData,
        layout: layoutData,
        firstLevelComponent: deepData
      };

    beforeEach(function () {
      sandbox = sinon.sandbox.create();
    });

    afterEach(function () {
      sandbox.restore();
    });

    describe('/_pages', function () {
      const path = this.title;

      beforeEach(function () {
        return apiAccepts.beforeEachTest({ sandbox, hostname, pathsAndData: {
          '/_layouts/layout': data.layout,
          '/_components/valid': data.firstLevelComponent,
          '/_components/valid@valid': data.firstLevelComponent,
          '/_pages/valid': data.page
        }});
      });

      acceptsJson(path, {}, 400, { message: 'Data missing layout reference.', code: 400 });
      acceptsJsonBody(path, {}, {}, 400, { message: 'Data missing layout reference.', code: 400 });
      acceptsJsonBody(path, {}, pageData, 201, function (result) {
        const body = result.body;

        expect(body.center).to.match(/^localhost.example.com\/_components\/valid\/instances\/.+/);
        expect(body.layout).to.equal(pageData.layout);
        expect(body._ref).to.match(/^localhost.example.com\/_pages\/.+/);
      });
      acceptsHtml(path, {}, 406, '406 text/html not acceptable');

      // block with _ref at root of object
      acceptsJsonBody(path, {}, _.assign({_ref: 'whatever'}, pageData), 400, {message: 'Reference (_ref) at root of object is not acceptable', code: 400});
    });

    describe('/_pages/:name', function () {
      const path = this.title;

      beforeEach(function () {
        return apiAccepts.beforeEachTest({ sandbox, hostname });
      });

      acceptsJson(path, {name: 'valid'}, 405, { allow:['get', 'put', 'delete'], code: 405, message: 'Method POST not allowed' });
      acceptsJsonBody(path, {name: 'valid'}, pageData, 405, { allow:['get', 'put', 'delete'], code: 405, message: 'Method POST not allowed' });
      acceptsHtml(path, {name: 'valid'}, 405, '405 Method POST not allowed');
    });

    describe('/_pages/:name@:version', function () {
      let path = this.title,
        version = 'def';

      beforeEach(function () {
        return apiAccepts.beforeEachTest({ sandbox, hostname });
      });

      acceptsJson(path, {name: 'valid', version}, 405, { allow:['get', 'put', 'delete'], code: 405, message: 'Method POST not allowed' });
      acceptsJsonBody(path, {name: 'valid', version}, pageData, 405, { allow:['get', 'put', 'delete'], code: 405, message: 'Method POST not allowed' });
      acceptsHtml(path, {name: 'valid', version}, 405, '405 Method POST not allowed');
    });
  });
});
