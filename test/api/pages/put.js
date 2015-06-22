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
        layout: '/components/layout',
        center: '/components/valid',
        side: ['/components/valid@valid']
      },
      cascadingPageData = {
        layout: '/components/layoutCascading',
        center: '/components/validCascading',
        side: ['/components/validCascading@valid']
      },
      layoutData = { someArea: ['center'] },
      componentData = { name: 'Manny', species: 'cat' },
      cascadingTarget = '/components/validDeep',
      addVersion = _.partial(replaceVersion, cascadingTarget),
      versionedPageData = function (version) {
        return {
          layout: '/components/layout@' + version,
          center: '/components/valid@' + version,
          side: ['/components/valid@' + version]
        };
      },
      cascadingReturnData = function (version) {
        return {
          layout: '/components/layoutCascading@' + version,
          center: '/components/validCascading@' + version,
          side: ['/components/validCascading@' + version]
        };
      };

    beforeEach(function () {
      sandbox = sinon.sandbox.create();
      return apiAccepts.beforeEachPageTest(sandbox,  hostname, pageData, layoutData, componentData);
    });

    afterEach(function () {
      sandbox.restore();
    });

    describe('/pages', function () {
      var path = this.title;

      acceptsJson(path, {}, 405, { allow:['get'], code: 405, message: 'Method PUT not allowed' });
      acceptsJsonBody(path, {}, {}, 405, { allow:['get'], code: 405, message: 'Method PUT not allowed' });
      acceptsHtml(path, {}, 405, '405 Method PUT not allowed');
    });

    describe('/pages/:name', function () {
      var path = this.title;

      acceptsJson(path, {name: 'valid'}, 200, {});
      acceptsJson(path, {name: 'missing'}, 200, {});

      acceptsJsonBody(path, {name: 'valid'}, pageData, 200, pageData);
      acceptsJsonBody(path, {name: 'missing'}, pageData, 200, pageData);

      acceptsHtml(path, {name: 'valid'}, 406, '406 text/html not acceptable');
      acceptsHtml(path, {name: 'missing'}, 406, '406 text/html not acceptable');
    });

    describe('/pages/:name@:version', function () {
      var path = this.title,
        version = 'def';

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
      cascades(path, {name: 'valid', version: version}, cascadingPageData, addVersion(version), componentData);
    });
  });
});