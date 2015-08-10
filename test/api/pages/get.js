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
      pageData = { layout: 'localhost.example.com/components/layout', center: 'localhost.example.com/components/valid' },
      layoutData = { someArea: ['center'] },
      deepData = { deep: {_ref: 'localhost.example.com/components/validDeep'} },
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
      acceptsJson(path, {}, 200, '["localhost.example.com/pages/valid"]');
      acceptsHtml(path, {}, 406);
    });

    describe('/pages/:name', function () {
      var path = this.title;

      acceptsJson(path, {name: 'valid'}, 200, pageData);
      acceptsJson(path, {name: 'missing'}, 404, { message: 'Not Found', code: 404 });
      acceptsHtml(path, {name: 'valid'}, 406, '406 text/html not acceptable');
      acceptsHtml(path, {name: 'missing'}, 406, '406 text/html not acceptable');
    });

    describe('/pages/:name.html', function () {
      var path = this.title;

      acceptsJson(path, {name: 'valid'}, 406, { message: 'application/json not acceptable', code: 406, accept: ['text/html'] });
      acceptsJson(path, {name: 'missing'}, 406, { message: 'application/json not acceptable', code: 406, accept: ['text/html'] });
      acceptsHtml(path, {name: 'valid'}, 200, '<valid>{' +
        '"refs":{"localhost.example.com/pages/valid":{"someArea":[{"_ref":"localhost.example.com/components/valid","deep":{"_ref":"localhost.example.com/components/validDeep","name":"Manny","species":"cat"}}],"template":"layout","_self":"localhost.example.com/pages/valid","_pageData":{"center":"localhost.example.com/components/valid"}},"localhost.example.com/components/valid":{"_ref":"localhost.example.com/components/valid","deep":{"_ref":"localhost.example.com/components/validDeep","name":"Manny","species":"cat"}},"localhost.example.com/components/validDeep":{"_ref":"localhost.example.com/components/validDeep","name":"Manny","species":"cat"}},' +
        '"components":["valid","validDeep"],' +
        '"someArea":[{"_ref":"localhost.example.com/components/valid","deep":{"_ref":"localhost.example.com/components/validDeep","name":"Manny","species":"cat"}}],' +
        '"template":"layout",' +
        '"_self":"localhost.example.com/pages/valid",' +
        '"_pageData":{"center":"localhost.example.com/components/valid"}' +
        '}</valid>');
      acceptsHtml(path, {name: 'missing'}, 404, '404 Not Found');
    });

    describe('/pages/:name@:version', function () {
      var path = this.title;

      acceptsJson(path, {name: 'valid', version: 'missing'}, 404, { message: 'Not Found', code: 404 });
      acceptsJson(path, {name: 'missing', version: 'missing'}, 404, { message: 'Not Found', code: 404 });
      acceptsJson(path, {name: 'valid', version: 'valid'}, 200, pageData);
      acceptsJson(path, {name: 'missing', version: 'valid'}, 404, { message: 'Not Found', code: 404 });

      acceptsHtml(path, {name: 'valid', version: 'missing'}, 406, '406 text/html not acceptable');
      acceptsHtml(path, {name: 'missing', version: 'missing'}, 406, '406 text/html not acceptable');
      acceptsHtml(path, {name: 'valid', version: 'valid'}, 406, '406 text/html not acceptable');
      acceptsHtml(path, {name: 'missing', version: 'valid'}, 406, '406 text/html not acceptable');
    });

    describe('/pages/:name@:version.html', function () {
      var path = this.title;

      acceptsJson(path, {name: 'valid', version: 'missing'}, 406, { message: 'application/json not acceptable', code: 406, accept: ['text/html'] });
      acceptsJson(path, {name: 'missing', version: 'missing'}, 406, { message: 'application/json not acceptable', code: 406, accept: ['text/html'] });
      acceptsJson(path, {name: 'valid', version: 'valid'}, 406, { message: 'application/json not acceptable', code: 406, accept: ['text/html'] });
      acceptsJson(path, {name: 'missing', version: 'valid'}, 406, { message: 'application/json not acceptable', code: 406, accept: ['text/html'] });

      acceptsHtml(path, {name: 'valid', version: 'missing'}, 404, '404 Not Found');
      acceptsHtml(path, {name: 'missing', version: 'missing'}, 404, '404 Not Found');
      acceptsHtml(path, {name: 'valid', version: 'valid'}, 200, '<valid>{' +
        '"refs":{"localhost.example.com/pages/valid@valid":{"someArea":[{"_ref":"localhost.example.com/components/valid","deep":{"_ref":"localhost.example.com/components/validDeep","name":"Manny","species":"cat"}}],"template":"layout","_self":"localhost.example.com/pages/valid@valid","_pageData":{"center":"localhost.example.com/components/valid"},"_version":"valid"},"localhost.example.com/components/valid":{"_ref":"localhost.example.com/components/valid","deep":{"_ref":"localhost.example.com/components/validDeep","name":"Manny","species":"cat"}},"localhost.example.com/components/validDeep":{"_ref":"localhost.example.com/components/validDeep","name":"Manny","species":"cat"}},' +
        '"components":["valid","validDeep"],' +
        '"someArea":[{"_ref":"localhost.example.com/components/valid","deep":{"_ref":"localhost.example.com/components/validDeep","name":"Manny","species":"cat"}}],' +
        '"template":"layout",' +
        '"_self":"localhost.example.com/pages/valid@valid",' +
        '"_pageData":{"center":"localhost.example.com/components/valid"},' +
        '"_version":"valid"}</valid>');
      acceptsHtml(path, {name: 'missing', version: 'valid'}, 404, '404 Not Found');
    });
  });
});