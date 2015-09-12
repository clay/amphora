'use strict';

var _ = require('lodash'),
  apiAccepts = require('../../fixtures/api-accepts'),
  endpointName = _.startCase(__dirname.split('/').pop()),
  filename = _.startCase(__filename.split('/').pop().split('.').shift()),
  replaceVersion = require('../../../lib/services/references').replaceVersion,
  sinon = require('sinon');

describe(endpointName, function () {
  describe(filename, function () {
    var sandbox,
      hostname = 'localhost.example.com',
      acceptsJson = apiAccepts.acceptsJson(_.camelCase(filename)),
      acceptsJsonBody = apiAccepts.acceptsJsonBody(_.camelCase(filename)),
      acceptsHtml = apiAccepts.acceptsHtml(_.camelCase(filename)),
      cascades = apiAccepts.cascades(_.camelCase(filename)),
      data = { name: 'Manny', species: 'cat' },
      cascadingTarget = 'localhost.example.com/components/validDeep',
      addVersion = _.partial(replaceVersion, cascadingTarget),
      cascadingData = function (version) {
        return {a: 'b', c: {_ref: addVersion(version), d: 'e'}};
      },
      cascadingReturnData = function (version) {
        return {a: 'b', c: {_ref: addVersion(version)}};
      },
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
      acceptsJsonBody(path, {name: 'valid'}, cascadingData(), 200, cascadingReturnData());

      acceptsHtml(path, {name: 'invalid'}, 404);
      acceptsHtml(path, {name: 'valid'}, 406);
      acceptsHtml(path, {name: 'missing'}, 406);

      cascades(path, {name: 'valid'}, cascadingData(), cascadingTarget, cascadingDeepData);
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
      var path = this.title,
        version = 'def';

      acceptsJson(path, {name: 'invalid', version: version}, 404, { code: 404, message: 'Not Found' });
      acceptsJson(path, {name: 'valid', version: version}, 200, {});
      acceptsJson(path, {name: 'missing', version: version}, 200, {});

      acceptsJsonBody(path, {name: 'invalid', version: version}, {}, 404, { code: 404, message: 'Not Found' });
      acceptsJsonBody(path, {name: 'valid', version: version}, data, 200, data);
      acceptsJsonBody(path, {name: 'missing', version: version}, data, 200, data);
      acceptsJsonBody(path, {name: 'valid', version: version}, cascadingData(), 200, cascadingReturnData());

      acceptsHtml(path, {name: 'invalid', version: version}, 404);
      acceptsHtml(path, {name: 'valid', version: version}, 406);
      acceptsHtml(path, {name: 'missing', version: version}, 406);

      cascades(path, {name: 'valid', version: version}, cascadingData(), cascadingTarget, cascadingDeepData);
    });

    describe('/components/:name/instances', function () {
      var path = this.title;

      acceptsJson(path, {name: 'invalid'}, 404, { code: 404, message: 'Not Found' });
      acceptsJson(path, {name: 'valid'}, 405, { allow:['get', 'post'], code: 405, message: 'Method PUT not allowed' });
      acceptsJson(path, {name: 'missing'}, 405, { allow:['get', 'post'], code: 405, message: 'Method PUT not allowed' });

      acceptsJsonBody(path, {name: 'invalid'}, {}, 404, { code: 404, message: 'Not Found' });
      acceptsJsonBody(path, {name: 'valid'}, data, 405, { allow:['get', 'post'], code: 405, message: 'Method PUT not allowed' });
      acceptsJsonBody(path, {name: 'missing'}, data, 405, { allow:['get', 'post'], code: 405, message: 'Method PUT not allowed' });

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
      acceptsJsonBody(path, {name: 'valid'}, cascadingData(), 200, cascadingReturnData());

      acceptsHtml(path, {name: 'invalid', id: 'valid'}, 404);
      acceptsHtml(path, {name: 'valid', id: 'valid'}, 406);
      acceptsHtml(path, {name: 'valid', id: 'missing'}, 406);

      cascades(path, {name: 'valid', id: 'valid'}, cascadingData(), cascadingTarget, cascadingDeepData);
    });

    describe('/components/:name/instances/:id@:version', function () {
      var path = this.title,
        version = 'def';

      acceptsJson(path, {name: 'invalid', version: version, id: 'valid'}, 404, { code: 404, message: 'Not Found' });
      acceptsJson(path, {name: 'valid', version: version, id: 'valid'}, 200, {});
      acceptsJson(path, {name: 'valid', version: version, id: 'missing'}, 200, {});

      acceptsJsonBody(path, {name: 'invalid', version: version, id: 'valid'}, {}, 404, { code: 404, message: 'Not Found' });
      acceptsJsonBody(path, {name: 'valid', version: version, id: 'valid'}, data, 200, data);
      acceptsJsonBody(path, {name: 'missing', version: version, id: 'missing'}, data, 200, data);
      acceptsJsonBody(path, {name: 'valid', version: version, id: 'valid'}, cascadingData(), 200, cascadingReturnData());

      acceptsHtml(path, {name: 'invalid', version: version, id: 'valid'}, 404);
      acceptsHtml(path, {name: 'valid', version: version, id: 'valid'}, 406);
      acceptsHtml(path, {name: 'valid', version: version, id: 'missing'}, 406);

      cascades(path, {name: 'valid', version: version, id: 'valid'}, cascadingData(), cascadingTarget, cascadingDeepData);

      //published version
      version = 'published';
      acceptsJsonBody(path, {name: 'valid', version: version, id: 'valid'}, data, 200, data);
      acceptsJsonBody(path, {name: 'valid', version: version, id: 'valid'}, cascadingData(version), 200, cascadingReturnData(version));
      cascades(path, {name: 'valid', version: version, id: 'valid'}, cascadingData(version), addVersion(version), cascadingDeepData);
    });
  });
});