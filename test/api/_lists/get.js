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

      acceptsJson(path, {}, 200, '["localhost.example.com/_lists/valid"]');
      acceptsHtml(path, {}, 406);
    });

    describe('/_lists/:name', function () {
      const path = this.title;

      acceptsJson(path, {name: 'invalid'}, 404);
      acceptsJson(path, {name: 'valid'}, 200, '["item1","item2"]');
      acceptsJson(path, {name: 'missing'}, 404);

      acceptsHtml(path, {name: 'invalid'}, 406);
      acceptsHtml(path, {name: 'valid'}, 406);
      acceptsHtml(path, {name: 'missing'}, 406);
    });
  });
});
