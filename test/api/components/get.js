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
      data = { name: 'Manny', species: 'cat' },
      // todo: Stop putting internal information into something we're going to open-source
      componentList = ['clay-c5', 'clay-c3', 'clay-c4'],
      message406 = '406 text/html not acceptable';

    beforeEach(function () {
      sandbox = sinon.sandbox.create();
      return apiAccepts.beforeEachComponentTest(sandbox,  hostname, data);
    });

    afterEach(function () {
      sandbox.restore();
    });

    describe('/components', function () {
      var path = this.title;
      acceptsJson(path, {}, 200, componentList);
      acceptsHtml(path, {}, 406, message406);
    });

    describe('/components/:name', function () {
      var path = this.title;

      acceptsJson(path, {name: 'invalid'}, 404);
      acceptsJson(path, {name: 'valid'}, 200, data);
      acceptsJson(path, {name: 'missing'}, 404);

      acceptsHtml(path, {name: 'invalid'}, 404, '404 Not Found');
      acceptsHtml(path, {name: 'valid'}, 406, message406);
      acceptsHtml(path, {name: 'missing'}, 406, message406);
    });

    describe('/components/:name/schema', function () {
      var path = this.title;

      acceptsJson(path, {name: 'invalid'}, 404);
      acceptsJson(path, {name: 'valid'}, 200, {some:'schema', thatIs:'valid'});
      acceptsJson(path, {name: 'missing'}, 404);

      acceptsHtml(path, {name: 'invalid'}, 404, '404 Not Found');
      acceptsHtml(path, {name: 'valid'}, 406, message406);
      acceptsHtml(path, {name: 'missing'}, 406, message406);
    });

    describe('/components/:name.html', function () {
      var path = this.title;

      acceptsJson(path, {name: 'invalid'}, 404);
      acceptsJson(path, {name: 'valid'}, 406, '{"message":"application/json not acceptable","code":406,"accept":["text/html"]}');
      acceptsJson(path, {name: 'missing'}, 406, '{"message":"application/json not acceptable","code":406,"accept":["text/html"]}');

      acceptsHtml(path, {name: 'invalid'}, 404, '404 Not Found');
      acceptsHtml(path, {name: 'valid'}, 200,
        '<valid>{' +
        '"_components":["valid"],' +
        '"name":"Manny",' +
        '"species":"cat",' +
        '"template":"valid",' +
        '"_self":"localhost.example.com/components/valid"' +
        '}</valid>');
      acceptsHtml(path, {name: 'missing'}, 404, '404 Not Found');
    });

    describe('/components/:name@:version', function () {
      var path = this.title;

      acceptsJson(path, {name: 'invalid', version: 'missing'}, 404);
      acceptsJson(path, {name: 'valid', version: 'missing'}, 404);
      acceptsJson(path, {name: 'missing', version: 'missing'}, 404);

      acceptsHtml(path, {name: 'invalid', version: 'missing'}, 404);
      acceptsHtml(path, {name: 'valid', version: 'missing'}, 406);
      acceptsHtml(path, {name: 'missing', version: 'missing'}, 406);
    });

    describe('/components/:name/instances', function () {
      var path = this.title;

      acceptsJson(path, {name: 'invalid'}, 404);
      acceptsJson(path, {name: 'valid'}, 200, '["localhost.example.com/components/valid/instances/valid"]');
      acceptsJson(path, {name: 'missing'}, 200, '[]');

      acceptsHtml(path, {name: 'invalid'}, 404, '404 Not Found');
      acceptsHtml(path, {name: 'valid'}, 406);
      acceptsHtml(path, {name: 'missing'}, 406);
    });

    describe('/components/:name/instances/:id', function () {
      var path = this.title;

      acceptsJson(path, {name: 'invalid', id: 'valid'}, 404);
      acceptsJson(path, {name: 'valid', id: 'valid'}, 200, data);
      acceptsJson(path, {name: 'valid', id: 'missing'}, 404);

      acceptsHtml(path, {name: 'invalid', id: 'valid'}, 404, '404 Not Found');
      acceptsHtml(path, {name: 'valid', id: 'valid'}, 406);
      acceptsHtml(path, {name: 'valid', id: 'missing'}, 406);
    });

    describe('/components/:name/instances/:id.html', function () {
      var path = this.title;

      acceptsJson(path, {name: 'invalid', id: 'valid'}, 404);
      acceptsJson(path, {name: 'valid', id: 'valid'}, 406, '{"message":"application/json not acceptable","code":406,"accept":["text/html"]}');
      acceptsJson(path, {name: 'valid', id: 'missing'}, 406, '{"message":"application/json not acceptable","code":406,"accept":["text/html"]}');

      acceptsHtml(path, {name: 'invalid', id: 'valid'}, 404, '404 Not Found');
      acceptsHtml(path, {name: 'valid', id: 'valid'}, 200, '<valid>{' +
        '"_components":["valid"],' +
        '"name":"Manny",' +
        '"species":"cat",' +
        '"template":"valid",' +
        '"_self":"localhost.example.com/components/valid/instances/valid"' +
        '}</valid>');
      acceptsHtml(path, {name: 'valid', id: 'missing'}, 404, '404 Not Found');
    });

    describe('/components/:name/instances/:id@:version', function () {
      var path = this.title;

      acceptsJson(path, {name: 'invalid', version: 'missing', id: 'valid'}, 404);
      acceptsJson(path, {name: 'valid', version: 'missing', id: 'valid'}, 404);
      acceptsJson(path, {name: 'valid', version: 'missing', id: 'missing'}, 404);

      acceptsHtml(path, {name: 'invalid', version: 'missing', id: 'valid'}, 404, '404 Not Found');
      acceptsHtml(path, {name: 'valid', version: 'missing', id: 'valid'}, 406);
      acceptsHtml(path, {name: 'valid', version: 'missing', id: 'missing'}, 406);
    });
  });
});
