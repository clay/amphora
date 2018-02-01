'use strict';

const _ = require('lodash'),
  apiAccepts = require('../../fixtures/api-accepts'),
  endpointName = _.startCase(__dirname.split('/').pop()),
  filename = _.startCase(__filename.split('/').pop().split('.')[0]),
  sinon = require('sinon');

describe(endpointName, function () {
  describe(filename, function () {
    let sandbox,
      hostname = 'localhost.example.com',
      acceptsJson = apiAccepts.acceptsJson(_.camelCase(filename)),
      acceptsJsonBody = apiAccepts.acceptsJsonBody(_.camelCase(filename)),
      acceptsHtml = apiAccepts.acceptsHtml(_.camelCase(filename)),
      data = ['item1', 'item2'];

    beforeEach(function () {
      sandbox = sinon.sandbox.create();
      return apiAccepts.beforeEachTest({ sandbox, hostname, pathsAndData: {'/_lists/valid': data} });
    });

    afterEach(function () {
      sandbox.restore();
    });

    describe('/_lists', function () {
      const path = this.title;

      acceptsJson(path, {}, 405, { allow:['get'], code: 405, message: 'Method PUT not allowed' });
      acceptsJsonBody(path, {}, {}, 405, { allow:['get'], code: 405, message: 'Method PUT not allowed' });
      acceptsHtml(path, {}, 406);
    });

    describe('/_lists/:name', function () {
      const path = this.title;

      acceptsJson(path, {name: 'valid'}, 400, {message: 'Only accepts lists.', code: 400});
      acceptsJson(path, {name: 'missing'}, 400, {message: 'Only accepts lists.', code: 400});

      // overrides existing data
      acceptsJsonBody(path, {name: 'valid'}, data, 200, data);
      acceptsJsonBody(path, {name: 'missing'}, data, 200, data);

      acceptsHtml(path, {name: 'valid'}, 406);
      acceptsHtml(path, {name: 'missing'}, 406);
    });
  });
});
