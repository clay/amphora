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
      acceptsHtml = apiAccepts.acceptsHtml(_.camelCase(filename)),
      data = { name: 'Manny', species: 'cat' },
      deepData = { d: 'e' },
      // todo: Stop putting internal information into something we're going to open-source
      componentList = ['clay-c5', 'clay-c3', 'clay-c4'],
      message406 = '406 text/html not acceptable',
      cascadingData = function (ref) {
        return {a: 'b', c: {_ref: `localhost.example.com/components/${ref}`}};
      },
      cascadingReturnData = function (ref) {
        return {a: 'b', c: {_ref: `localhost.example.com/components/${ref}`, d: 'e'}};
      };

    beforeEach(function () {
      sandbox = sinon.sandbox.create();
    });

    afterEach(function () {
      sandbox.restore();
    });

    describe('/components', function () {
      const path = this.title;

      beforeEach(function () {
        return apiAccepts.beforeEachTest({ sandbox, hostname });
      });

      acceptsJson(path, {}, 200, componentList);
      acceptsHtml(path, {}, 406, message406);
    });

    describe('/components/:name', function () {
      const path = this.title;

      beforeEach(function () {
        return apiAccepts.beforeEachTest({ sandbox, hostname, pathsAndData: {
          '/components/valid': data
        }});
      });

      acceptsJson(path, {name: 'invalid'}, 404);
      acceptsJson(path, {name: 'valid'}, 200, data);
      acceptsJson(path, {name: 'missing'}, 404);

      acceptsHtml(path, {name: 'invalid'}, 404, '404 Not Found');
      acceptsHtml(path, {name: 'valid'}, 406, message406);
      acceptsHtml(path, {name: 'missing'}, 406, message406);

      // deny trailing slash
      acceptsJson(path + '/', {name: 'valid'}, 400, { message: 'Trailing slash on RESTful id in URL is not acceptable', code: 400 });
    });

    describe('/components/:name.json', function () {
      const path = this.title;

      beforeEach(function () {
        return apiAccepts.beforeEachTest({ sandbox, hostname, pathsAndData: {
          '/components/valid': cascadingData('valid-deep'),
          '/components/valid-deep': deepData
        }});
      });

      acceptsJson(path, {name: 'invalid'}, 404);
      acceptsJson(path, {name: 'valid'}, 200, cascadingReturnData('valid-deep'));
      acceptsJson(path, {name: 'missing'}, 404);

      acceptsHtml(path, {name: 'invalid'}, 404, '404 Not Found');
      acceptsHtml(path, {name: 'valid'}, 406, message406);
      acceptsHtml(path, {name: 'missing'}, 406, message406);
    });

    describe('/components/:name/schema', function () {
      const path = this.title;

      beforeEach(function () {
        return apiAccepts.beforeEachTest({ sandbox, hostname });
      });

      acceptsJson(path, {name: 'invalid'}, 404);
      acceptsJson(path, {name: 'valid'}, 200, {some:'schema', thatIs:'valid'});
      acceptsJson(path, {name: 'missing'}, 404);

      acceptsHtml(path, {name: 'invalid'}, 404, '404 Not Found');
      acceptsHtml(path, {name: 'valid'}, 406, message406);
      acceptsHtml(path, {name: 'missing'}, 406, message406);
    });

    describe('/components/:name.html', function () {
      const path = this.title;

      beforeEach(function () {
        return apiAccepts.beforeEachTest({ sandbox, hostname, pathsAndData: {
          '/components/valid': data
        }});
      });

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

    describe('/components/:name.bad', function () {
      const path = this.title;

      beforeEach(function () {
        return apiAccepts.beforeEachTest({ sandbox, hostname, pathsAndData: {
          '/components/valid': data
        }});
      });

      acceptsJson(path, {name: 'invalid'}, 404);
      acceptsJson(path, {name: 'valid'}, 404, '{"message":"Not Found","code":404}');
      acceptsJson(path, {name: 'missing'}, 404, '{"message":"Not Found","code":404}');

      acceptsHtml(path, {name: 'invalid'}, 404, '404 Not Found');
      acceptsHtml(path, {name: 'valid'}, 404, '404 Not Found');
      acceptsHtml(path, {name: 'missing'}, 404, '404 Not Found');
    });

    describe('/components/:name@:version', function () {
      const path = this.title;

      beforeEach(function () {
        return apiAccepts.beforeEachTest({ sandbox, hostname, pathsAndData: {
          '/components/valid@valid': data
        }});
      });

      acceptsJson(path, {name: 'invalid', version: 'missing'}, 404);
      acceptsJson(path, {name: 'valid', version: 'missing'}, 404);
      acceptsJson(path, {name: 'valid', version: 'valid'}, 200, data);
      acceptsJson(path, {name: 'missing', version: 'missing'}, 404);

      acceptsHtml(path, {name: 'invalid', version: 'missing'}, 404);
      acceptsHtml(path, {name: 'valid', version: 'missing'}, 406);
      acceptsHtml(path, {name: 'missing', version: 'missing'}, 406);

      // deny trailing slash
      acceptsJson(path + '/', {name: 'valid', version: 'valid'}, 400, { message: 'Trailing slash on RESTful id in URL is not acceptable', code: 400 });
    });

    describe('/components/:name/instances', function () {
      const path = this.title;

      beforeEach(function () {
        return apiAccepts.beforeEachTest({ sandbox, hostname, pathsAndData: {
          '/components/valid': data,
          '/components/valid/instances/valid': data,
          '/components/valid/instances/valid@valid': data
        }});
      });

      acceptsJson(path, {name: 'invalid'}, 404);
      // no versioned or base instances in list
      acceptsJson(path, {name: 'valid'}, 200, '["localhost.example.com/components/valid/instances/valid"]');
      acceptsJson(path, {name: 'missing'}, 200, '[]');

      acceptsHtml(path, {name: 'invalid'}, 404, '404 Not Found');
      acceptsHtml(path, {name: 'valid'}, 406);
      acceptsHtml(path, {name: 'missing'}, 406);
    });

    describe('/components/:name/instances/:id', function () {
      const path = this.title;

      beforeEach(function () {
        return apiAccepts.beforeEachTest({ sandbox, hostname, pathsAndData: {
          '/components/valid/instances/valid': data
        }});
      });

      acceptsJson(path, {name: 'invalid', id: 'valid'}, 404);
      acceptsJson(path, {name: 'valid', id: 'valid'}, 200, data);
      acceptsJson(path, {name: 'valid', id: 'missing'}, 404);

      acceptsHtml(path, {name: 'invalid', id: 'valid'}, 404, '404 Not Found');
      acceptsHtml(path, {name: 'valid', id: 'valid'}, 406);
      acceptsHtml(path, {name: 'valid', id: 'missing'}, 406);

      // deny trailing slash
      acceptsJson(path + '/', {name: 'valid', id: 'valid'}, 400, { message: 'Trailing slash on RESTful id in URL is not acceptable', code: 400 });
    });

    describe('/components/:name/instances/:id.json', function () {
      const path = this.title;

      beforeEach(function () {
        return apiAccepts.beforeEachTest({ sandbox, hostname, pathsAndData: {
          '/components/valid/instances/valid': cascadingData('valid-deep/instances/valid-deep'),
          '/components/valid-deep/instances/valid-deep': deepData
        }});
      });

      acceptsJson(path, {name: 'invalid', id: 'valid'}, 404);
      acceptsJson(path, {name: 'valid', id: 'valid'}, 200, cascadingReturnData('valid-deep/instances/valid-deep'));
      acceptsJson(path, {name: 'valid', id: 'missing'}, 404);

      acceptsHtml(path, {name: 'invalid', id: 'valid'}, 404, '404 Not Found');
      acceptsHtml(path, {name: 'valid', id: 'valid'}, 406);
      acceptsHtml(path, {name: 'valid', id: 'missing'}, 406);
    });

    describe('/components/:name/instances/:id.html', function () {
      const path = this.title;

      beforeEach(function () {
        return apiAccepts.beforeEachTest({ sandbox, hostname, pathsAndData: {
          '/components/valid/instances/valid': data
        }});
      });

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
      const path = this.title;

      beforeEach(function () {
        return apiAccepts.beforeEachTest({ sandbox, hostname, pathsAndData: {
          '/components/valid/instances/valid@valid': data
        }});
      });

      acceptsJson(path, {name: 'invalid', version: 'missing', id: 'valid'}, 404);
      acceptsJson(path, {name: 'valid', version: 'valid', id: 'valid'}, 200, data);
      acceptsJson(path, {name: 'valid', version: 'missing', id: 'valid'}, 404);
      acceptsJson(path, {name: 'valid', version: 'missing', id: 'missing'}, 404);

      acceptsHtml(path, {name: 'invalid', version: 'missing', id: 'valid'}, 404, '404 Not Found');
      acceptsHtml(path, {name: 'valid', version: 'missing', id: 'valid'}, 406);
      acceptsHtml(path, {name: 'valid', version: 'missing', id: 'missing'}, 406);

      // deny trailing slash
      acceptsJson(path + '/', {name: 'valid', version: 'valid', id: 'valid'}, 400, { message: 'Trailing slash on RESTful id in URL is not acceptable', code: 400 });
    });
  });
});
