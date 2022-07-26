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
      acceptsJsonBody = apiAccepts.acceptsJsonBody(_.camelCase(filename)),
      start = ['item1', 'item2'],
      data = {
        add: ['item3', 'item4'],
        remove: ['item1']
      },
      end = ['item2', 'item3', 'item4'];

    beforeEach(function () {
      sandbox = sinon.sandbox.create();
      return apiAccepts.beforeEachTest({ sandbox, hostname, pathsAndData: {'/_lists/valid': start} });
    });

    afterEach(function () {
      sandbox.restore();
    });

    describe('/_lists/:name', function () {
      const path = this.title;

      // overrides existing data
      acceptsJsonBody(path, {name: 'valid'}, data, 200, end);
      acceptsJsonBody(path, {name: 'missing'}, data, 404);
    });
  });
});
