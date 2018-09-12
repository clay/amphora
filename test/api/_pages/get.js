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
      acceptRedirect = apiAccepts.acceptRedirect(_.camelCase(filename)),
      pageData = { layout: 'localhost.example.com/_components/layout', center: ['localhost.example.com/_components/valid'] },
      layoutData = { center: 'center', deep: [{_ref: 'localhost.example.com/_components/validDeep'}] },
      deepData = { _ref: 'localhost.example.com/_components/validDeep' },
      componentData = { name: 'Manny', species: 'cat' },
      data = {
        page: pageData,
        layout: layoutData,
        firstLevelComponent: deepData,
        secondLevelComponent: componentData
      },
      deepPageData = {
        center: [{ _ref: 'localhost.example.com/_components/valid' }],
        deep: [{
          _ref: 'localhost.example.com/_components/validDeep',
          name: 'Manny',
          species: 'cat'
        }]
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
          '/_components/valid': data.firstLevelComponent,
          '/_pages/valid': data.page,
          '/_pages/valid@valid': data.page
        }});
      });

      // only pages, and only unversioned
      acceptsJson(path, {}, 200, '["localhost.example.com/_pages/valid"]');
    });

    describe('/_pages/@published', function () {
      const path = this.title;

      beforeEach(function () {
        return apiAccepts.beforeEachTest({ sandbox, hostname, pathsAndData: {
          '/_components/valid': data.firstLevelComponent,
          '/_pages/valid': data.page,
          '/_pages/valid@published': data.page
        }});
      });

      // only pages, and only unversioned
      acceptsJson(path, {}, 200, '["localhost.example.com/_pages/valid@published"]');
    });

    describe('/_pages/:name', function () {
      const path = this.title;

      beforeEach(function () {
        return apiAccepts.beforeEachTest({ sandbox, hostname, pathsAndData: {
          '/_pages/valid': data.page
        }});
      });

      acceptsJson(path, {name: 'valid'}, 200, pageData);
      acceptsJson(path, {name: 'missing'}, 404, { message: 'Not Found', code: 404 });
    });

    describe('/_pages/:name.json', function () {
      const path = this.title;

      beforeEach(function () {
        return apiAccepts.beforeEachTest({ sandbox, hostname, pathsAndData: {
          '/_components/layout': data.layout,
          '/_components/layoutCascading': data.firstLevelComponent,
          '/_components/valid': data.firstLevelComponent,
          '/_components/validCascading': data.firstLevelComponent,
          '/_components/validDeep': data.secondLevelComponent,
          '/_pages/valid': data.page
        }});
      });

      acceptsJson(path, {name: 'valid'}, 200, deepPageData);
      acceptsJson(path, {name: 'missing'}, 404, { message: 'Not Found', code: 404 });
    });

    describe('/_pages/:name@:version', function () {
      const path = this.title;

      beforeEach(function () {
        return apiAccepts.beforeEachTest({ sandbox, hostname, pathsAndData: {
          '/_pages/valid@valid': data.page
        }});
      });

      acceptsJson(path, {name: 'valid', version: 'missing'}, 404, { message: 'Not Found', code: 404 });
      acceptsJson(path, {name: 'missing', version: 'missing'}, 404, { message: 'Not Found', code: 404 });
      acceptsJson(path, {name: 'valid', version: 'valid'}, 200, pageData);
      acceptsJson(path, {name: 'missing', version: 'valid'}, 404, { message: 'Not Found', code: 404 });

      // blocks trailing slash
      acceptsJson(path + '/', {name: 'valid', version: 'valid'}, 400, { message: 'Trailing slash on RESTful id in URL is not acceptable', code: 400 });
    });

    describe('/_pages/:name/meta', function () {
      const path = this.title;

      beforeEach(function () {
        return apiAccepts.beforeEachTest({ sandbox, hostname });
      });

      acceptsJson(path, { name: 'valid' }, 200, {});
    });

    describe('/_pages/:name@published/meta', function () {
      const path = this.title;

      beforeEach(function () {
        return apiAccepts.beforeEachTest({ sandbox, hostname });
      });

      acceptRedirect(path, { name: 'valid' }, 303, {});
    });
  });
});
