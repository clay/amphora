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
      data = { name: 'Manny', species: 'cat' },
      deepData = { d: 'e' },
      componentList = ['clay-c5', 'clay-c3', 'clay-c4'],
      cascadingData = function (ref) {
        return {a: 'b', c: {_ref: `localhost.example.com/_components/${ref}`}};
      },
      cascadingReturnData = function (ref) {
        return {a: 'b', c: {_ref: `localhost.example.com/_components/${ref}`, d: 'e'}};
      };

    beforeEach(function () {
      sandbox = sinon.sandbox.create();
    });

    afterEach(function () {
      sandbox.restore();
    });

    describe('/_components', function () {
      const path = this.title;

      beforeEach(function () {
        return apiAccepts.beforeEachTest({ sandbox, hostname });
      });

      acceptsJson(path, {}, 200, componentList);
    });

    describe('/_components/:name', function () {
      const path = this.title;

      beforeEach(function () {
        return apiAccepts.beforeEachTest({ sandbox, hostname, pathsAndData: {
          '/_components/valid': data
        }});
      });

      acceptsJson(path, {name: 'invalid'}, 404);
      acceptsJson(path, {name: 'valid'}, 200, data);
      acceptsJson(path, {name: 'missing'}, 404);

      // deny trailing slash
      acceptsJson(path + '/', {name: 'valid'}, 400, { message: 'Trailing slash on RESTful id in URL is not acceptable', code: 400 });
    });

    describe('/_components/:name.json', function () {
      const path = this.title;

      beforeEach(function () {
        return apiAccepts.beforeEachTest({ sandbox, hostname, pathsAndData: {
          '/_components/valid': cascadingData('valid-deep'),
          '/_components/valid-deep': deepData
        }});
      });

      acceptsJson(path, {name: 'invalid'}, 404);
      acceptsJson(path, {name: 'valid'}, 200, cascadingReturnData('valid-deep'));
      acceptsJson(path, {name: 'missing'}, 404);
    });

    describe('/_components/:name/schema', function () {
      const path = this.title;

      beforeEach(function () {
        return apiAccepts.beforeEachTest({ sandbox, hostname });
      });

      acceptsJson(path, {name: 'invalid'}, 404);
      acceptsJson(path, {name: 'valid'}, 200, {some:'schema', thatIs:'valid'});
      acceptsJson(path, {name: 'missing'}, 404);
    });

    describe('/_components/:name@:version', function () {
      const path = this.title;

      beforeEach(function () {
        return apiAccepts.beforeEachTest({ sandbox, hostname, pathsAndData: {
          '/_components/valid@valid': data
        }});
      });

      acceptsJson(path, {name: 'invalid', version: 'missing'}, 404);
      acceptsJson(path, {name: 'valid', version: 'missing'}, 404);
      acceptsJson(path, {name: 'valid', version: 'valid'}, 200, data);
      acceptsJson(path, {name: 'missing', version: 'missing'}, 404);

      // deny trailing slash
      acceptsJson(path + '/', {name: 'valid', version: 'valid'}, 400, { message: 'Trailing slash on RESTful id in URL is not acceptable', code: 400 });
    });

    describe('/_components/:name/instances', function () {
      const path = this.title;

      beforeEach(function () {
        return apiAccepts.beforeEachTest({ sandbox, hostname, pathsAndData: {
          '/_components/valid': data,
          '/_components/valid/instances/valid': data,
          '/_components/valid/instances/valid@valid': data
        }});
      });

      acceptsJson(path, {name: 'invalid'}, 404);
      // no versioned or base instances in list
      acceptsJson(path, {name: 'valid'}, 200, '["localhost.example.com/_components/valid/instances/valid"]');
      acceptsJson(path, {name: 'missing'}, 200, '[]');
    });

    describe('/_components/:name/instances/@published', function () {
      const path = this.title;

      beforeEach(function () {
        return apiAccepts.beforeEachTest({ sandbox, hostname, pathsAndData: {
          '/_components/valid': data,
          '/_components/valid/instances/valid': data,
          '/_components/valid/instances/valid@published': data
        }});
      });

      acceptsJson(path, {name: 'invalid'}, 404);
      acceptsJson(path, {name: 'valid'}, 200, '["localhost.example.com/_components/valid/instances/valid@published"]');
      acceptsJson(path, {name: 'missing'}, 200, '[]');
    });

    describe('/_components/:name/instances/:id', function () {
      const path = this.title;

      beforeEach(function () {
        return apiAccepts.beforeEachTest({ sandbox, hostname, pathsAndData: {
          '/_components/valid/instances/valid': data
        }});
      });

      acceptsJson(path, {name: 'invalid', id: 'valid'}, 404);
      acceptsJson(path, {name: 'valid', id: 'valid'}, 200, data);
      acceptsJson(path, {name: 'valid', id: 'missing'}, 404);

      // deny trailing slash
      acceptsJson(path + '/', {name: 'valid', id: 'valid'}, 400, { message: 'Trailing slash on RESTful id in URL is not acceptable', code: 400 });
    });

    describe('/_components/:name/instances/:id.json', function () {
      const path = this.title;

      beforeEach(function () {
        return apiAccepts.beforeEachTest({ sandbox, hostname, pathsAndData: {
          '/_components/valid/instances/valid': cascadingData('valid-deep/instances/valid-deep'),
          '/_components/valid-deep/instances/valid-deep': deepData
        }});
      });

      acceptsJson(path, {name: 'invalid', id: 'valid'}, 404);
      acceptsJson(path, {name: 'valid', id: 'valid'}, 200, cascadingReturnData('valid-deep/instances/valid-deep'));
      acceptsJson(path, {name: 'valid', id: 'missing'}, 404);
    });

    describe('/_components/:name/instances/:id@:version', function () {
      const path = this.title;

      beforeEach(function () {
        return apiAccepts.beforeEachTest({ sandbox, hostname, pathsAndData: {
          '/_components/valid/instances/valid@valid': data
        }});
      });

      acceptsJson(path, {name: 'invalid', version: 'missing', id: 'valid'}, 404);
      acceptsJson(path, {name: 'valid', version: 'valid', id: 'valid'}, 200, data);
      acceptsJson(path, {name: 'valid', version: 'missing', id: 'valid'}, 404);
      acceptsJson(path, {name: 'valid', version: 'missing', id: 'missing'}, 404);

      // deny trailing slash
      acceptsJson(path + '/', {name: 'valid', version: 'valid', id: 'valid'}, 400, { message: 'Trailing slash on RESTful id in URL is not acceptable', code: 400 });
    });
  });
});
