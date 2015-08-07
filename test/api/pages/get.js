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
      pageData = { layout: '/components/layout', center: '/components/valid' },
      layoutData = { someArea: ['center'] },
      deepData = { deep: {_ref: '/components/validDeep'} },
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
      acceptsJson(path, {}, 200, '["/pages/valid"]');
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
        '"refs":{"/components/valid":{"_ref":"/components/valid","deep":{"_ref":"/components/validDeep","name":"Manny","species":"cat"}},"/components/validDeep":{"_ref":"/components/validDeep","name":"Manny","species":"cat"},"/pages/valid":{"someArea":[{"_ref":"/components/valid","deep":{"_ref":"/components/validDeep","name":"Manny","species":"cat"}}],"template":"layout","_self":"/pages/valid","_pageData":{"center":"/components/valid"}}},' +
        '"components":["valid","validDeep"],' +
        '"someArea":[{"_ref":"/components/valid","deep":{"_ref":"/components/validDeep","name":"Manny","species":"cat"}}],' +
        '"template":"layout",' +
        '"_self":"/pages/valid",' +
        '"_pageData":{"center":"/components/valid"}' +
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
        '"refs":{"/components/valid":{"_ref":"/components/valid","deep":{"_ref":"/components/validDeep","name":"Manny","species":"cat"}},"/components/validDeep":{"_ref":"/components/validDeep","name":"Manny","species":"cat"},"/pages/valid@valid":{"someArea":[{"_ref":"/components/valid","deep":{"_ref":"/components/validDeep","name":"Manny","species":"cat"}}],' +
        '"template":"layout",' +
        '"_self":"/pages/valid@valid",' +
        '"_pageData":{"center":"/components/valid"},' +
        '"_version":"valid"}},' +
        '"components":["valid","validDeep"],' +
        '"someArea":[{"_ref":"/components/valid","deep":{"_ref":"/components/validDeep","name":"Manny","species":"cat"}}],' +
        '"template":"layout",' +
        '"_self":"/pages/valid@valid",' +
        '"_pageData":{"center":"/components/valid"},' +
        '"_version":"valid"}</valid>');
      acceptsHtml(path, {name: 'missing', version: 'valid'}, 404, '404 Not Found');
    });
  });
});