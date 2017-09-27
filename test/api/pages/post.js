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
        layout: 'localhost.example.com/components/layout',
        center: 'localhost.example.com/components/valid',
        side: ['localhost.example.com/components/valid@valid']
      },
      deepData = { deep: {_ref: 'localhost.example.com/components/validDeep'} },
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

    describe('/pages', function () {
      const path = this.title;

      beforeEach(function () {
        return apiAccepts.beforeEachTest({ sandbox, hostname, pathsAndData: {
          '/components/layout': data.layout,
          '/components/valid': data.firstLevelComponent,
          '/components/valid@valid': data.firstLevelComponent,
          '/_pages/valid': data.page
        }});
      });

      acceptsJson(path, {}, 400, { message: 'Data missing layout reference.', code: 400 });
      acceptsJsonBody(path, {}, {}, 400, { message: 'Data missing layout reference.', code: 400 });
      acceptsJsonBody(path, {}, pageData, 201, function (result) {
        const body = result.body;

        expect(body.center).to.match(/^localhost.example.com\/components\/valid\/instances\/.+/);
        expect(body.side[0]).to.match(/^localhost.example.com\/components\/valid\/instances\/.+/);
        expect(body.layout).to.equal(pageData.layout);
        expect(body._ref).to.match(/^localhost.example.com\/pages\/.+/);
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
