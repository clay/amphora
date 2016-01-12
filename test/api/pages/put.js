'use strict';

var _ = require('lodash'),
  apiAccepts = require('../../fixtures/api-accepts'),
  endpointName = _.startCase(__dirname.split('/').pop()),
  filename = _.startCase(__filename.split('/').pop().split('.').shift()),
  replaceVersion = require('../../../lib/services/references').replaceVersion,
  sinon = require('sinon');

describe(endpointName, function () {
  describe(filename, function () {
    var sandbox,
      hostname = 'localhost.example.com',
      acceptsJson = apiAccepts.acceptsJson(_.camelCase(filename)),
      acceptsJsonBody = apiAccepts.acceptsJsonBody(_.camelCase(filename)),
      acceptsHtml = apiAccepts.acceptsHtml(_.camelCase(filename)),
      cascades = apiAccepts.cascades(_.camelCase(filename)),
      pageData = {
        url: 'http://localhost.example.com',
        layout: 'localhost.example.com/components/layout',
        center: 'localhost.example.com/components/valid',
        side: ['localhost.example.com/components/valid@valid']
      },
      cascadingPageData = {
        url: 'http://localhost.example.com',
        layout: 'localhost.example.com/components/layoutCascading',
        center: 'localhost.example.com/components/validCascading',
        side: ['localhost.example.com/components/validCascading@valid']
      },
      deepData = { deep: {_ref: 'localhost.example.com/components/validDeep'} },
      layoutData = { someArea: ['center'] },
      componentData = { name: 'Manny', species: 'cat' },
      cascadingTarget = 'localhost.example.com/components/validDeep',
      versionedPageData = function (version) {
        return {
          url: 'http://localhost.example.com',
          layout: 'localhost.example.com/components/layout@' + version,
          center: 'localhost.example.com/components/valid@' + version,
          side: ['localhost.example.com/components/valid@' + version]
        };
      },
      versionedDeepData = function (version) {
        return { deep: {_ref: 'localhost.example.com/components/validDeep@' + version} };
      },
      cascadingReturnData = function (version) {
        return {
          url: 'http://localhost.example.com',
          layout: 'localhost.example.com/components/layoutCascading@' + version,
          center: 'localhost.example.com/components/validCascading@' + version,
          side: ['localhost.example.com/components/validCascading@' + version]
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

    describe('/pages', function () {
      var path = this.title;

      beforeEach(function () {
        return apiAccepts.beforeEachTest({ sandbox: sandbox, hostname: hostname });
      });

      acceptsJson(path, {}, 405, { allow:['get', 'post'], code: 405, message: 'Method PUT not allowed' });
      acceptsJsonBody(path, {}, {}, 405, { allow:['get', 'post'], code: 405, message: 'Method PUT not allowed' });
      acceptsHtml(path, {}, 405, '405 Method PUT not allowed');
    });

    describe('/pages/:name', function () {
      var path = this.title;

      beforeEach(function () {
        return apiAccepts.beforeEachTest({ sandbox: sandbox, hostname: hostname });
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

    describe('/pages/:name@:version', function () {
      var path = this.title,
        version = 'def';

      beforeEach(function () {
        return apiAccepts.beforeEachTest({
          sandbox: sandbox,
          hostname: hostname,
          pathsAndData: {
            '/components/layout': data.layout,
            '/components/layout@valid': data.layout,
            '/components/layoutCascading': data.firstLevelComponent,
            '/components/valid': data.firstLevelComponent,
            '/components/valid@valid': data.firstLevelComponent,
            '/components/validCascading': data.firstLevelComponent,
            '/components/validCascading@valid': data.firstLevelComponent,
            '/components/validDeep': data.secondLevelComponent,
            '/components/validDeep@valid': data.secondLevelComponent,
            '/pages/valid': data.page,
            '/pages/valid@valid': data.page
          }
        });
      });

      acceptsJson(path, {name: 'valid', version: version}, 200, {});
      acceptsJson(path, {name: 'missing', version: version}, 200, {});

      acceptsJsonBody(path, {name: 'valid', version: version}, pageData, 200, pageData);
      acceptsJsonBody(path, {name: 'missing', version: version}, pageData, 200, pageData);

      acceptsHtml(path, {name: 'valid', version: version}, 406, '406 text/html not acceptable');
      acceptsHtml(path, {name: 'missing', version: version}, 406, '406 text/html not acceptable');

      //published
      version = 'published';
      acceptsJsonBody(path, {name: 'valid', version: version}, pageData, 200, versionedPageData(version));
      acceptsJsonBody(path, {name: 'valid', version: version}, cascadingPageData, 200, cascadingReturnData(version));
      cascades(path, {name: 'valid', version: version}, cascadingPageData, replaceVersion(cascadingPageData.center, version), versionedDeepData(version));
      cascades(path, {name: 'valid', version: version}, cascadingPageData, replaceVersion(cascadingTarget, version), componentData);

      // block with _ref at root of object
      acceptsJsonBody(path, {name: 'valid', version: version}, _.assign({_ref: 'whatever'}, pageData), 400, {message: 'Reference (_ref) at root of object is not acceptable', code: 400});
    });
  });
});