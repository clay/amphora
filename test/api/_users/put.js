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
      acceptsJsonBody = apiAccepts.acceptsJsonBody(_.camelCase(filename)),
      acceptsHtml = apiAccepts.acceptsHtml(_.camelCase(filename)),
      data = { username: 'manny', provider: 'google', auth: 'admin' },
      expectedData = _.assign({_ref: '/_users/bWFubnlAZ29vZ2xl'}, data);

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

      acceptsJson(path, {}, 405, { allow:['get', 'post'], code: 405, message: 'Method PUT not allowed' });
      acceptsJsonBody(path, {}, {}, 405, { allow:['get', 'post'], code: 405, message: 'Method PUT not allowed' });
      acceptsHtml(path, {}, 405);
    });

    describe('/_users/:name', function () {
      const path = this.title;

      beforeEach(function () {
        return apiAccepts.beforeEachTest({ sandbox, hostname });
      });

      acceptsJsonBody(path, {name: 'valid'}, data, 200, expectedData);
      acceptsJsonBody(path, {name: 'missing'}, data, 200, expectedData);

      acceptsHtml(path, {name: 'valid'}, 406);
      acceptsHtml(path, {name: 'missing'}, 406);

      // deny trailing slashes
      acceptsJsonBody(path + '/', {name: 'valid'}, data, 400, { message: 'Trailing slash on RESTful id in URL is not acceptable', code: 400 });
    });
  });
});
