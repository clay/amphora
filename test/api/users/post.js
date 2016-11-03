'use strict';

const _ = require('lodash'),
  apiAccepts = require('../../fixtures/api-accepts'),
  endpointName = _.startCase(__dirname.split('/').pop()),
  filename = _.startCase(__filename.split('/').pop().split('.').shift()),
  sinon = require('sinon'),
  winston = require('winston');

describe(endpointName, function () {
  describe(filename, function () {
    let sandbox,
      hostname = 'localhost.example.com',
      acceptsJson = apiAccepts.acceptsJson(_.camelCase(filename)),
      acceptsJsonBody = apiAccepts.acceptsJsonBody(_.camelCase(filename)),
      acceptsHtml = apiAccepts.acceptsHtml(_.camelCase(filename)),
      expectDataPlusRef = apiAccepts.expectDataPlusRef,
      data = {username: 'foo', provider: 'bar'};

    beforeEach(function () {
      sandbox = sinon.sandbox.create();
      sandbox.stub(winston);
    });

    afterEach(function () {
      sandbox.restore();
    });

    describe('/users', function () {
      const path = this.title;

      beforeEach(function () {
        return apiAccepts.beforeEachTest({ sandbox, hostname  });
      });

      acceptsJson(path, {name: 'valid'}, 500, { message: 'Users require username and provider to be specified!', code: 500 });
      acceptsJson(path, {name: 'missing'}, 500, { message: 'Users require username and provider to be specified!', code: 500 });

      acceptsJsonBody(path, {name: 'valid'}, data, 200, expectDataPlusRef(data));
      acceptsJsonBody(path, {name: 'missing'}, data, 200, expectDataPlusRef(data));

      acceptsHtml(path, {name: 'valid'}, 406, '406 text/html not acceptable');
      acceptsHtml(path, {name: 'missing'}, 406, '406 text/html not acceptable');

      // block with _ref at root of object
      acceptsJsonBody(path, {name: 'valid'}, _.assign({_ref: 'whatever'}, data), 400, {message: 'Reference (_ref) at root of object is not acceptable', code: 400});
    });

    describe('/users/:name', function () {
      const path = this.title;

      beforeEach(function () {
        return apiAccepts.beforeEachTest({ sandbox, hostname  });
      });

      acceptsJson(path, {name: 'invalid'}, 405, { allow:['get', 'put', 'delete'], code: 405, message: 'Method POST not allowed' });
      acceptsJson(path, {name: 'valid'}, 405, { allow:['get', 'put', 'delete'], code: 405, message: 'Method POST not allowed' });
      acceptsJson(path, {name: 'missing'}, 405, { allow:['get', 'put', 'delete'], code: 405, message: 'Method POST not allowed' });

      acceptsHtml(path, {name: 'invalid'}, 406, '406 text/html not acceptable');
      acceptsHtml(path, {name: 'valid'}, 406, '406 text/html not acceptable');
      acceptsHtml(path, {name: 'missing'}, 406, '406 text/html not acceptable');
    });
  });
});
