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
      acceptsJsonBody = apiAccepts.acceptsJsonBody(_.camelCase(filename)),
      acceptsHtml = apiAccepts.acceptsHtml(_.camelCase(filename)),
      pageData = {
        layout: 'localhost.example.com/components/layout',
        center: 'localhost.example.com/components/valid',
        side: ['localhost.example.com/components/valid@valid']
      },
      deepData = { deep: {_ref: 'localhost.example.com/components/validDeep'} },
      layoutData = { someArea: ['center'] },
      componentData = { name: 'Manny', species: 'cat' },
      data = {
        page: pageData,
        layout: layoutData,
        firstLevelComponent: deepData,
        secondLevelComponent: componentData
      };

    beforeEach(function () {
      sandbox = sinon.sandbox.create();
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

    afterEach(function () {
      sandbox.restore();
    });

    describe('/pages', function () {
      var path = this.title;

      acceptsJson(path, {}, 405, { allow:['get', 'post'], code: 405, message: 'Method DELETE not allowed' });
      acceptsJsonBody(path, {}, {}, 405, { allow:['get', 'post'], code: 405, message: 'Method DELETE not allowed' });
      acceptsHtml(path, {}, 405, '405 Method DELETE not allowed');
    });

    describe('/pages/:name', function () {
      var path = this.title;

      acceptsJson(path, {name: 'valid'}, 200, pageData);
      acceptsJson(path, {name: 'missing'}, 404, { message: 'Not Found', code: 404 });

      acceptsJsonBody(path, {name: 'valid'}, pageData, 200, pageData);
      acceptsJsonBody(path, {name: 'missing'}, pageData, 404, { message: 'Not Found', code: 404 });

      acceptsHtml(path, {name: 'valid'}, 406, '406 text/html not acceptable');
      acceptsHtml(path, {name: 'missing'}, 406, '406 text/html not acceptable');
    });

    describe('/pages/:name.html', function () {
      var path = this.title;

      acceptsJson(path, {name: 'valid'}, 405, { message: 'Method DELETE not allowed', code: 405, allow: ['get'] });
      acceptsJson(path, {name: 'missing'}, 405, { message: 'Method DELETE not allowed', code: 405, allow: ['get'] });

      acceptsJsonBody(path, {name: 'valid'}, pageData, 405, { message: 'Method DELETE not allowed', code: 405, allow: ['get'] });
      acceptsJsonBody(path, {name: 'missing'}, pageData, 405, { message: 'Method DELETE not allowed', code: 405, allow: ['get'] });

      acceptsHtml(path, {name: 'valid'}, 405, '405 Method DELETE not allowed');
      acceptsHtml(path, {name: 'missing'}, 405, '405 Method DELETE not allowed');
    });

    describe('/pages/:name@:version', function () {
      var path = this.title;

      acceptsJson(path, {name: 'valid', version: 'valid'}, 200, pageData);
      acceptsJson(path, {name: 'valid', version: 'missing'}, 404, { message: 'Not Found', code: 404 });

      acceptsJsonBody(path, {name: 'valid', version: 'valid'}, pageData, 200, pageData);
      acceptsJsonBody(path, {name: 'valid', version: 'missing'}, pageData, 404, { message: 'Not Found', code: 404 });

      acceptsHtml(path, {name: 'valid', version: 'valid'}, 406, '406 text/html not acceptable');
      acceptsHtml(path, {name: 'valid', version: 'missing'}, 406, '406 text/html not acceptable');
    });

    describe('/pages/:name@:version.html', function () {
      var path = this.title;

      acceptsJson(path, {name: 'valid', version: 'valid'}, 405, { message: 'Method DELETE not allowed', code: 405, allow: ['get'] });
      acceptsJson(path, {name: 'valid', version: 'missing'}, 405, { message: 'Method DELETE not allowed', code: 405, allow: ['get'] });

      acceptsJsonBody(path, {name: 'valid', version: 'valid'}, pageData, 405, { message: 'Method DELETE not allowed', code: 405, allow: ['get'] });
      acceptsJsonBody(path, {name: 'valid', version: 'missing'}, pageData, 405, { message: 'Method DELETE not allowed', code: 405, allow: ['get'] });

      acceptsHtml(path, {name: 'valid', version: 'valid'}, 405, '405 Method DELETE not allowed');
      acceptsHtml(path, {name: 'valid', version: 'missing'}, 405, '405 Method DELETE not allowed');
    });
  });
});