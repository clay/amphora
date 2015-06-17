'use strict';

var _ = require('lodash'),
  apiAccepts = require('../../fixtures/api-accepts'),
  endpointName = _.startCase(__dirname.split('/').pop()),
  filename = _.startCase(__filename.split('/').pop().split('.').shift()),
  sinon = require('sinon');

describe(endpointName, function () {
  describe(filename, function () {
    var sandbox,
      hostname = 'localhost.example.com',
      acceptsJson = apiAccepts.acceptsJson(_.camelCase(filename)),
      acceptsJsonBody = apiAccepts.acceptsJsonBody(_.camelCase(filename)),
      acceptsHtml = apiAccepts.acceptsHtml(_.camelCase(filename)),
      updatesOther = apiAccepts.updatesOther(_.camelCase(filename)),
      createsNewVersion = apiAccepts.createsNewVersion(_.camelCase(filename)),
      cascades = apiAccepts.cascades(_.camelCase(filename)),
      data = { name: 'Manny', species: 'cat' },
      cascadingTarget = '/components/validDeep',
      cascadingData = {a: 'b', c: {_ref: cascadingTarget, d: 'e'}},
      cascadingReturnData = {a: 'b', c: {_ref: cascadingTarget}},
      cascadingDeepData = {d: 'e'};

    beforeEach(function () {
      sandbox = sinon.sandbox.create();
      return apiAccepts.beforeEachComponentTest(sandbox,  hostname, data);
    });

    afterEach(function () {
      sandbox.restore();
    });

    describe('/components', function () {
      var path = this.title;

      acceptsJson(path, {}, 405, { allow:['get'], code: 405, message: 'Method PUT not allowed' });
      acceptsJsonBody(path, {}, {}, 405, { allow:['get'], code: 405, message: 'Method PUT not allowed' });
      acceptsHtml(path, {}, 405);
    });

    describe('/components/:name', function () {
      var path = this.title;

      acceptsJson(path, {name: 'invalid'}, 404, { code: 404, message: 'Not Found' });
      acceptsJson(path, {name: 'valid'}, 200, {});
      acceptsJson(path, {name: 'missing'}, 200, {});

      acceptsJsonBody(path, {name: 'invalid'}, {}, 404, { code: 404, message: 'Not Found' });
      acceptsJsonBody(path, {name: 'valid'}, data, 200, data);
      acceptsJsonBody(path, {name: 'missing'}, data, 200, data);
      acceptsJsonBody(path, {name: 'valid'}, cascadingData, 200, cascadingReturnData);

      acceptsHtml(path, {name: 'invalid'}, 404);
      acceptsHtml(path, {name: 'valid'}, 406);
      acceptsHtml(path, {name: 'missing'}, 406);

      cascades(path, {name: 'valid'}, cascadingData, cascadingTarget, cascadingDeepData);
    });

    describe('/components/:name/schema', function () {
      var path = this.title;

      acceptsJson(path, {name: 'invalid'}, 404);
      acceptsJson(path, {name: 'valid'}, 405, { allow:['get'], code: 405, message: 'Method PUT not allowed' });
      acceptsJson(path, {name: 'missing'}, 405, { allow:['get'], code: 405, message: 'Method PUT not allowed' });

      acceptsHtml(path, {name: 'invalid'}, 404);
      acceptsHtml(path, {name: 'valid'}, 405);
      acceptsHtml(path, {name: 'missing'}, 405);
    });

    describe('/components/:name@:version', function () {
      var path = this.title;

      acceptsJson(path, {name: 'invalid', version: 'def'}, 404, { code: 404, message: 'Not Found' });
      acceptsJson(path, {name: 'valid', version: 'def'}, 200, {});
      acceptsJson(path, {name: 'missing', version: 'def'}, 200, {});

      acceptsJsonBody(path, {name: 'invalid', version: 'def'}, {}, 404, { code: 404, message: 'Not Found' });
      acceptsJsonBody(path, {name: 'valid', version: 'def'}, data, 200, data);
      acceptsJsonBody(path, {name: 'missing', version: 'def'}, data, 200, data);
      acceptsJsonBody(path, {name: 'valid', version: 'def'}, cascadingData, 200, cascadingReturnData);

      acceptsHtml(path, {name: 'invalid', version: 'def'}, 404);
      acceptsHtml(path, {name: 'valid', version: 'def'}, 406);
      acceptsHtml(path, {name: 'missing', version: 'def'}, 406);

      cascades(path, {name: 'valid', version: 'def'}, cascadingData, cascadingTarget, cascadingDeepData);
    });

    describe('/components/:name/instances', function () {
      var path = this.title;

      acceptsJson(path, {name: 'invalid'}, 404, { code: 404, message: 'Not Found' });
      acceptsJson(path, {name: 'valid'}, 405, { allow:['get'], code: 405, message: 'Method PUT not allowed' });
      acceptsJson(path, {name: 'missing'}, 405, { allow:['get'], code: 405, message: 'Method PUT not allowed' });

      acceptsJsonBody(path, {name: 'invalid'}, {}, 404, { code: 404, message: 'Not Found' });
      acceptsJsonBody(path, {name: 'valid'}, data, 405, { allow:['get'], code: 405, message: 'Method PUT not allowed' });
      acceptsJsonBody(path, {name: 'missing'}, data, 405, { allow:['get'], code: 405, message: 'Method PUT not allowed' });

      acceptsHtml(path, {name: 'invalid'}, 404);
      acceptsHtml(path, {name: 'valid'}, 406);
      acceptsHtml(path, {name: 'missing'}, 406);
    });

    describe('/components/:name/instances/:id', function () {
      var path = this.title;

      acceptsJson(path, {name: 'invalid', id: 'valid'}, 404, { code: 404, message: 'Not Found' });
      acceptsJson(path, {name: 'valid', id: 'valid'}, 200, {});
      acceptsJson(path, {name: 'valid', id: 'missing'}, 200, {});

      acceptsJsonBody(path, {name: 'invalid', id: 'valid'}, {}, 404, { code: 404, message: 'Not Found' });
      acceptsJsonBody(path, {name: 'valid', id: 'valid'}, data, 200, data);
      acceptsJsonBody(path, {name: 'missing', id: 'missing'}, data, 200, data);
      acceptsJsonBody(path, {name: 'valid'}, cascadingData, 200, cascadingReturnData);

      acceptsHtml(path, {name: 'invalid', id: 'valid'}, 404);
      acceptsHtml(path, {name: 'valid', id: 'valid'}, 406);
      acceptsHtml(path, {name: 'valid', id: 'missing'}, 406);

      cascades(path, {name: 'valid', id: 'valid'}, cascadingData, cascadingTarget, cascadingDeepData);

      updatesOther(path, path + '@latest', {name: 'valid', id: 'newId'}, data);
      updatesOther(path + '@latest', path, {name: 'valid', id: 'newId'}, data);

      createsNewVersion(path, {name: 'valid', id: 'newId'}, data);
      createsNewVersion(path + '@latest', {name: 'valid', id: 'newId'}, data);
      createsNewVersion(path + '@published', {name: 'valid', id: 'newId'}, data);
    });

    describe('/components/:name/instances/:id@:version', function () {
      var path = this.title;

      acceptsJson(path, {name: 'invalid', version: 'def', id: 'valid'}, 404, { code: 404, message: 'Not Found' });
      acceptsJson(path, {name: 'valid', version: 'def', id: 'valid'}, 200, {});
      acceptsJson(path, {name: 'valid', version: 'def', id: 'missing'}, 200, {});

      acceptsJsonBody(path, {name: 'invalid', version: 'def', id: 'valid'}, {}, 404, { code: 404, message: 'Not Found' });
      acceptsJsonBody(path, {name: 'valid', version: 'def', id: 'valid'}, data, 200, data);
      acceptsJsonBody(path, {name: 'missing', version: 'def', id: 'missing'}, data, 200, data);
      acceptsJsonBody(path, {name: 'valid', version: 'def', id: 'valid'}, cascadingData, 200, cascadingReturnData);

      acceptsHtml(path, {name: 'invalid', version: 'def', id: 'valid'}, 404);
      acceptsHtml(path, {name: 'valid', version: 'def', id: 'valid'}, 406);
      acceptsHtml(path, {name: 'valid', version: 'def', id: 'missing'}, 406);

      cascades(path, {name: 'valid', version: 'def', id: 'valid'}, cascadingData, cascadingTarget, cascadingDeepData);
    });
  });
});