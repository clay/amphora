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
      data = { username: 'manny', provider: 'google', auth: 'admin' },
      message406 = '406 text/html not acceptable';

    beforeEach(function () {
      sandbox = sinon.sandbox.create();
    });

    afterEach(function () {
      sandbox.restore();
    });

    describe('/_users', function () {
      const path = this.title;

      beforeEach(function () {
        return apiAccepts.beforeEachTest({ sandbox, hostname });
      });

      acceptsJson(path, {}, 200, []);
      acceptsHtml(path, {}, 406, message406);
    });

    describe('/_users/:name', function () {
      const path = this.title;

      beforeEach(function () {
        return apiAccepts.beforeEachTest({ sandbox, hostname, pathsAndData: {
          '(ignoreHost)/_users/valid': data
        }});
      });

      acceptsJson(path, {name: 'invalid'}, 404);
      acceptsJson(path, {name: 'valid'}, 200, data);
      acceptsJson(path, {name: 'missing'}, 404);

      acceptsHtml(path, {name: 'invalid'}, 406, message406);
      acceptsHtml(path, {name: 'valid'}, 406, message406);
      acceptsHtml(path, {name: 'missing'}, 406, message406);

      // deny trailing slash
      acceptsJson(path + '/', {name: 'valid'}, 400, { message: 'Trailing slash on RESTful id in URL is not acceptable', code: 400 });
    });
  });
});
