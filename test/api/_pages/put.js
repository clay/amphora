'use strict';

const _ = require('lodash'),
  apiAccepts = require('../../fixtures/api-accepts'),
  endpointName = _.startCase(__dirname.split('/').pop()),
  filename = _.startCase(__filename.split('/').pop().split('.').shift()),
  replaceVersion = require('../../../lib/services/references').replaceVersion,
  sinon = require('sinon');

describe(endpointName, function () {
  describe(filename, function () {
    let sandbox,
      hostname = 'localhost.example.com',
      acceptsJson = apiAccepts.acceptsJson(_.camelCase(filename)),
      acceptsJsonBody = apiAccepts.acceptsJsonBody(_.camelCase(filename)),
      acceptsHtml = apiAccepts.acceptsHtml(_.camelCase(filename)),
      cascades = apiAccepts.cascades(_.camelCase(filename)),
      pageData = {
        url: 'http://localhost.example.com',
        layout: 'localhost.example.com/_components/layout',
        center: 'localhost.example.com/_components/valid',
        side: ['localhost.example.com/_components/valid@valid']
      },
      cascadingPageData = {
        url: 'http://localhost.example.com',
        layout: 'localhost.example.com/_components/layoutCascading',
        center: 'localhost.example.com/_components/validCascading',
        side: ['localhost.example.com/_components/validCascading@valid']
      },
      deepData = { deep: {_ref: 'localhost.example.com/_components/validDeep'} },
      layoutData = { someArea: ['center'] },
      componentData = { name: 'Manny', species: 'cat' },
      cascadingTarget = 'localhost.example.com/_components/validDeep',
      versionedPageData = function (version) {
        return {
          urlHistory: [
            'http://localhost.example.com'
          ],
          url: 'http://localhost.example.com',
          layout: 'localhost.example.com/_components/layout@' + version,
          center: 'localhost.example.com/_components/valid@' + version,
          side: ['localhost.example.com/_components/valid@' + version]
        };
      },
      versionedDeepData = function (version) {
        return { deep: {_ref: 'localhost.example.com/_components/validDeep@' + version} };
      },
      cascadingReturnData = function (version) {
        return {
          urlHistory: [
            'http://localhost.example.com'
          ],
          url: 'http://localhost.example.com',
          layout: 'localhost.example.com/_components/layoutCascading@' + version,
          center: 'localhost.example.com/_components/validCascading@' + version,
          side: ['localhost.example.com/_components/validCascading@' + version]
        };
      },
      data = {
        page: pageData,
        layout: layoutData,
        firstLevelComponent: deepData,
        secondLevelComponent: componentData
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
        return apiAccepts.beforeEachTest({ sandbox, hostname });
      });

      acceptsJson(path, {}, 405, { allow:['get', 'post'], code: 405, message: 'Method PUT not allowed' });
      acceptsJsonBody(path, {}, {}, 405, { allow:['get', 'post'], code: 405, message: 'Method PUT not allowed' });
      acceptsHtml(path, {}, 405, '405 Method PUT not allowed');
    });

    describe('/_pages/:name', function () {
      const path = this.title;

      beforeEach(function () {
        return apiAccepts.beforeEachTest({ sandbox, hostname });
      });

      acceptsJson(path, {name: 'valid'}, 200, {});
      acceptsJson(path, {name: 'missing'}, 200, {});

      acceptsJsonBody(path, {name: 'valid'}, pageData, 200, pageData);
      acceptsJsonBody(path, {name: 'missing'}, pageData, 200, pageData);

      acceptsHtml(path, {name: 'valid'}, 406, '406 text/html not acceptable');
      acceptsHtml(path, {name: 'missing'}, 406, '406 text/html not acceptable');

      // block with _ref at root of object
      acceptsJsonBody(path, {name: 'valid'}, _.assign({_ref: 'whatever'}, pageData), 400, {message: 'Reference (_ref) at root of object is not acceptable', code: 400});
    });

    describe('/_pages/:name@:version', function () {
      let path = this.title,
        version = 'def';

      beforeEach(function () {
        return apiAccepts.beforeEachTest({ sandbox, hostname, pathsAndData: {
          '/_components/layout': data.layout,
          '/_components/layout@valid': data.layout,
          '/_components/layoutCascading': data.firstLevelComponent,
          '/_components/valid': data.firstLevelComponent,
          '/_components/valid@valid': data.firstLevelComponent,
          '/_components/validCascading': data.firstLevelComponent,
          '/_components/validCascading@valid': data.firstLevelComponent,
          '/_components/validDeep': data.secondLevelComponent,
          '/_components/validDeep@valid': data.secondLevelComponent,
          '/_pages/valid': data.page,
          '/_pages/valid@valid': data.page
        }});
      });

      acceptsJson(path, {name: 'valid', version}, 200, {});
      acceptsJson(path, {name: 'missing', version}, 200, {});

      acceptsJsonBody(path, {name: 'valid', version}, pageData, 200, pageData);
      acceptsJsonBody(path, {name: 'missing', version}, pageData, 200, pageData);

      acceptsHtml(path, {name: 'valid', version}, 406, '406 text/html not acceptable');
      acceptsHtml(path, {name: 'missing', version}, 406, '406 text/html not acceptable');

      // published
      version = 'published';
      acceptsJsonBody(path, {name: 'valid', version}, pageData, 200, versionedPageData(version));
      acceptsJsonBody(path, {name: 'valid', version}, cascadingPageData, 200, cascadingReturnData(version));
      cascades(path, {name: 'valid', version}, cascadingPageData, replaceVersion(cascadingPageData.center, version), versionedDeepData(version));
      cascades(path, {name: 'valid', version}, cascadingPageData, replaceVersion(cascadingTarget, version), componentData);

      // published blank data will publish @latest
      acceptsJsonBody(path, {name: 'valid', version}, {}, 200, versionedPageData(version));
      acceptsJsonBody(path, {name: 'missing', version}, {}, 404, { code: 404, message: 'Not Found'});

      // block with _ref at root of object
      acceptsJsonBody(path, {name: 'valid', version}, _.assign({_ref: 'whatever'}, pageData), 400, {message: 'Reference (_ref) at root of object is not acceptable', code: 400});
      acceptsJsonBody(path + '/', {name: 'valid', version}, pageData, 400, { message: 'Trailing slash on RESTful id in URL is not acceptable', code: 400 });
    });
  });
});
