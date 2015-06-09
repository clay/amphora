'use strict';

var _ = require('lodash'),
  apiAccepts = require('../../fixtures/api-accepts'),
  endpointName = _.startCase(__dirname.split('/').pop()),
  filename = _.startCase(__filename.split('/').pop().split('.').shift()),
  sinon = require('sinon'),
  beforeEachTest = require('./all').beforeEachTest;

describe(endpointName, function () {
  describe(filename, function () {
    var sandbox,
      hostname = 'localhost.example.com',
      acceptsJson = apiAccepts.acceptsJson(_.camelCase(filename)),
      acceptsHtml = apiAccepts.acceptsHtml(_.camelCase(filename)),
      data = { name: 'Manny', species: 'cat' };

    beforeEach(function () {
      sandbox = sinon.sandbox.create();
      return beforeEachTest(sandbox,  hostname, data);
    });

    afterEach(function () {
      sandbox.restore();
    });

    describe('/uris', function () {
      var path = this.title;
      acceptsJson(path, {}, 200, '["/uris/valid"]');
      acceptsHtml(path, {}, 406);
    });

    describe('/uris/:name', function () {
      var path = this.title;

      acceptsJson(path, {name: 'invalid'}, 404);
      acceptsJson(path, {name: 'valid'}, 200, '"{\\"name\\":\\"Manny\\",\\"species\\":\\"cat\\"}"');
      acceptsJson(path, {name: 'missing'}, 404);

      acceptsHtml(path, {name: 'invalid'}, 406);
      acceptsHtml(path, {name: 'valid'}, 406);
      acceptsHtml(path, {name: 'missing'}, 406);
    });
  });
});