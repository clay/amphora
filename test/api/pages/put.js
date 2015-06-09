'use strict';

var _ = require('lodash'),
  apiAccepts = require('../../fixtures/api-accepts'),
  endpointName = _.startCase(__dirname.split('/').pop()),
  filename = _.startCase(__filename.split('/').pop().split('.').shift()),
  sinon = require('sinon'),
  beforeEachTest = require('./all').beforeEachTest;

describe(endpointName, function () {
  describe(filename, function () {
    var sandbox,
      hostname = 'localhost.example.com',
      acceptsJson = apiAccepts.acceptsJson(_.camelCase(filename)),
      acceptsJsonBody = apiAccepts.acceptsJsonBody(_.camelCase(filename)),
      acceptsHtml = apiAccepts.acceptsHtml(_.camelCase(filename)),
      pageData = { layout: '/components/layout', center: '/components/valid' },
      layoutData = { someArea: ['center'] },
      componentData = { name: 'Manny', species: 'cat' };

    beforeEach(function () {
      sandbox = sinon.sandbox.create();
      return beforeEachTest(sandbox,  hostname, pageData, layoutData, componentData);
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
      var path = this.title;

      acceptsJson(path, {name: 'valid', version: 'abc'}, 200, {});
      acceptsJson(path, {name: 'missing', version: 'abc'}, 200, {});

      acceptsJsonBody(path, {name: 'valid', version: 'def'}, pageData, 200, pageData);
      acceptsJsonBody(path, {name: 'missing', version: 'def'}, pageData, 200, pageData);

      acceptsHtml(path, {name: 'valid', version: 'ghi'}, 406, '406 text/html not acceptable');
      acceptsHtml(path, {name: 'missing', version: 'ghi'}, 406, '406 text/html not acceptable');
    });
  });
});