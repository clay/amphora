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
      pageData = { layout: 'localhost.example.com/components/layout', center: ['localhost.example.com/components/valid'] },
      layoutData = { center: 'center', deep: [{_ref: 'localhost.example.com/components/validDeep'}] },
      deepData = { _ref: 'localhost.example.com/components/validDeep' },
      componentData = { name: 'Manny', species: 'cat' },
      data = {
        page: pageData,
        layout: layoutData,
        firstLevelComponent: deepData,
        secondLevelComponent: componentData
      },
      deepPageData = {
        center: [{ _ref: 'localhost.example.com/components/valid' }],
        deep: [{
          _ref: 'localhost.example.com/components/validDeep',
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

    describe('/pages', function () {
      const path = this.title;

      beforeEach(function () {
        return apiAccepts.beforeEachTest({ sandbox, hostname, pathsAndData: {
          '/components/valid': data.firstLevelComponent,
          '/pages/valid': data.page,
          '/pages/valid@valid': data.page
        }});
      });

      // only pages, and only unversioned
      acceptsJson(path, {}, 200, '["localhost.example.com/pages/valid"]');
    });

    describe('/pages/@published', function () {
      const path = this.title;

      beforeEach(function () {
        return apiAccepts.beforeEachTest({ sandbox, hostname, pathsAndData: {
          '/components/valid': data.firstLevelComponent,
          '/pages/valid': data.page,
          '/pages/valid@published': data.page
        }});
      });

      // only pages, and only unversioned
      acceptsJson(path, {}, 200, '["localhost.example.com/pages/valid@published"]');
    });

    describe('/pages/:name', function () {
      const path = this.title;

      beforeEach(function () {
        return apiAccepts.beforeEachTest({ sandbox, hostname, pathsAndData: {
          '/pages/valid': data.page
        }});
      });

      acceptsJson(path, {name: 'valid'}, 200, pageData);
      acceptsJson(path, {name: 'missing'}, 404, { message: 'Not Found', code: 404 });
    });

    describe('/pages/:name.json', function () {
      const path = this.title;

      beforeEach(function () {
        return apiAccepts.beforeEachTest({ sandbox, hostname, pathsAndData: {
          '/components/layout': data.layout,
          '/components/layoutCascading': data.firstLevelComponent,
          '/components/valid': data.firstLevelComponent,
          '/components/validCascading': data.firstLevelComponent,
          '/components/validDeep': data.secondLevelComponent,
          '/pages/valid': data.page
        }});
      });

      acceptsJson(path, {name: 'valid'}, 200, deepPageData);
      acceptsJson(path, {name: 'missing'}, 404, { message: 'Not Found', code: 404 });
    });

    describe('/pages/:name@:version', function () {
      const path = this.title;

      beforeEach(function () {
        return apiAccepts.beforeEachTest({ sandbox, hostname, pathsAndData: {
          '/pages/valid@valid': data.page
        }});
      });

      acceptsJson(path, {name: 'valid', version: 'missing'}, 404, { message: 'Not Found', code: 404 });
      acceptsJson(path, {name: 'missing', version: 'missing'}, 404, { message: 'Not Found', code: 404 });
      acceptsJson(path, {name: 'valid', version: 'valid'}, 200, pageData);
      acceptsJson(path, {name: 'missing', version: 'valid'}, 404, { message: 'Not Found', code: 404 });

      // blocks trailing slash
      acceptsJson(path + '/', {name: 'valid', version: 'valid'}, 400, { message: 'Trailing slash on RESTful id in URL is not acceptable', code: 400 });
    });
  });
});
