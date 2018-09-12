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
      acceptRedirect = apiAccepts.acceptRedirect(_.camelCase(filename)),
      data = { main: 'main' },
      deepData = { d: 'e' },
      cascadingData = ref => {
        return {a: 'b', c: {_ref: `localhost.example.com/_layouts/${ref}`}};
      },
      cascadingReturnData = ref => {
        return {a: 'b', c: {_ref: `localhost.example.com/_layouts/${ref}`, d: 'e'}};
      };

    beforeEach(function () {
      sandbox = sinon.sandbox.create();
    });

    afterEach(function () {
      sandbox.restore();
    });

    describe('/_layouts', function () {
      const path = this.title;

      beforeEach(function () {
        return apiAccepts.beforeEachTest({ sandbox, hostname, pathsAndData: {
          '/_layouts/valid': data.firstLevelComponent,
          '/_pages/valid': data.page,
          '/_pages/valid@valid': data.page
        }});
      });

      // only pages, and only unversioned
      acceptsJson(path, {}, 200, '["layout1","layout2","layout3"]');
    });

    describe('/_layouts/:name/instances', function () {
      const path = this.title;

      beforeEach(function () {
        return apiAccepts.beforeEachTest({ sandbox, hostname, pathsAndData: {
          '/_layouts/valid': data,
          '/_layouts/valid/instances/valid': data,
          '/_layouts/valid/instances/valid@valid': data
        }});
      });

      acceptsJson(path, {name: 'invalid'}, 404);
      // no versioned or base instances in list
      acceptsJson(path, {name: 'valid'}, 200, '["localhost.example.com/_layouts/valid/instances/valid"]');
      acceptsJson(path, {name: 'missing'}, 200, '[]');
    });

    describe('/_layouts/:name@:version', function () {
      const path = this.title;

      beforeEach(function () {
        return apiAccepts.beforeEachTest({ sandbox, hostname, pathsAndData: {
          '/_layouts/valid@valid': data
        }});
      });

      acceptsJson(path, {name: 'invalid', version: 'missing'}, 404);
      acceptsJson(path, {name: 'valid', version: 'missing'}, 404);
      acceptsJson(path, {name: 'valid', version: 'valid'}, 200, data);
      acceptsJson(path, {name: 'missing', version: 'missing'}, 404);

      // deny trailing slash
      acceptsJson(path + '/', {name: 'valid', version: 'valid'}, 400, { message: 'Trailing slash on RESTful id in URL is not acceptable', code: 400 });
    });

    describe('/_layouts/:name/schema', function () {
      const path = this.title;

      beforeEach(function () {
        return apiAccepts.beforeEachTest({ sandbox, hostname });
      });

      acceptsJson(path, {name: 'invalid'}, 404);
      acceptsJson(path, {name: 'valid'}, 200, {some:'schema', thatIs:'valid'});
      acceptsJson(path, {name: 'missing'}, 404);
    });

    describe('/_layouts/:name/instances/@published', function () {
      const path = this.title;

      beforeEach(function () {
        return apiAccepts.beforeEachTest({ sandbox, hostname, pathsAndData: {
          '/_layouts/valid': data,
          '/_layouts/valid/instances/valid': data,
          '/_layouts/valid/instances/valid@published': data
        }});
      });

      acceptsJson(path, {name: 'invalid'}, 404);
      acceptsJson(path, {name: 'valid'}, 200, '["localhost.example.com/_layouts/valid/instances/valid@published"]');
      acceptsJson(path, {name: 'missing'}, 200, '[]');
    });

    describe('/_layouts/:name/instances/:id', function () {
      const path = this.title;

      beforeEach(function () {
        return apiAccepts.beforeEachTest({ sandbox, hostname, pathsAndData: {
          '/_layouts/valid/instances/valid': data
        }});
      });

      acceptsJson(path, {name: 'invalid', id: 'valid'}, 404);
      acceptsJson(path, {name: 'valid', id: 'valid'}, 200, data);
      acceptsJson(path, {name: 'valid', id: 'missing'}, 404);

      // deny trailing slash
      acceptsJson(path + '/', {name: 'valid', id: 'valid'}, 400, { message: 'Trailing slash on RESTful id in URL is not acceptable', code: 400 });
    });

    describe('/_layouts/:name/instances/:id.json', function () {
      const path = this.title;

      beforeEach(function () {
        return apiAccepts.beforeEachTest({ sandbox, hostname, pathsAndData: {
          '/_layouts/valid/instances/valid': cascadingData('valid-deep/instances/valid-deep'),
          '/_layouts/valid-deep/instances/valid-deep': deepData
        }});
      });

      acceptsJson(path, {name: 'invalid', id: 'valid'}, 404);
      acceptsJson(path, {name: 'valid', id: 'valid'}, 200, cascadingReturnData('valid-deep/instances/valid-deep'));
      acceptsJson(path, {name: 'valid', id: 'missing'}, 404);
    });

    describe('/_layouts/:name/instances/:id/meta', function () {
      const path = this.title;

      beforeEach(function () {
        return apiAccepts.beforeEachTest({ sandbox, hostname });
      });

      acceptsJson(path, { name: 'valid', id: 'valid' }, 200, {});
    });

    describe('/_layouts/:name/instances/:id@published/meta', function () {
      const path = this.title;

      beforeEach(function () {
        return apiAccepts.beforeEachTest({ sandbox, hostname });
      });

      acceptRedirect(path, { name: 'valid', id: 'valid' }, 303, {});
    });
  });
});
