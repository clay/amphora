'use strict';

const _ = require('lodash'),
  apiAccepts = require('../../fixtures/api-accepts'),
  endpointName = _.startCase(__dirname.split('/').pop()),
  filename = _.startCase(__filename.split('/').pop().split('.').shift()),
  replaceVersion = require('../../../lib/services/references').replaceVersion,
  sinon = require('sinon');

describe(endpointName, function () {
  describe(filename, function () {
    let sandbox,
      hostname = 'localhost.example.com',
      acceptsJson = apiAccepts.acceptsJson(_.camelCase(filename)),
      acceptsJsonBody = apiAccepts.acceptsJsonBody(_.camelCase(filename)),
      cascades = apiAccepts.cascades(_.camelCase(filename)),
      data = { name: 'Manny', species: 'cat' },
      cascadingTarget = 'localhost.example.com/_components/validDeep',
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
    });

    afterEach(function () {
      sandbox.restore();
    });

    describe('/_components', function () {
      const path = this.title;

      beforeEach(function () {
        return apiAccepts.beforeEachTest({ sandbox, hostname });
      });

      acceptsJson(path, {}, 405, { allow:['get'], code: 405, message: 'Method PUT not allowed' });
      acceptsJsonBody(path, {}, {}, 405, { allow:['get'], code: 405, message: 'Method PUT not allowed' });
    });

    describe('/_components/:name', function () {
      const path = this.title;

      beforeEach(function () {
        return apiAccepts.beforeEachTest({ sandbox, hostname });
      });

      acceptsJson(path, {name: 'invalid'}, 404, { code: 404, message: 'Not Found' });
      acceptsJson(path, {name: 'valid'}, 200, {});
      acceptsJson(path, {name: 'missing'}, 200, {});

      acceptsJsonBody(path, {name: 'invalid'}, {}, 404, { code: 404, message: 'Not Found' });
      acceptsJsonBody(path, {name: 'valid'}, data, 200, data);
      acceptsJsonBody(path, {name: 'missing'}, data, 200, data);
      acceptsJsonBody(path, {name: 'valid'}, cascadingData(), 200, cascadingReturnData());

      cascades(path, {name: 'valid'}, cascadingData(), cascadingTarget, cascadingDeepData);

      // block with _ref at root of object
      acceptsJsonBody(path, {name: 'valid'}, _.assign({_ref: 'whatever'}, data), 400, {message: 'Reference (_ref) at root of object is not acceptable', code: 400});

      // deny trailing slashes
      acceptsJsonBody(path + '/', {name: 'valid'}, data, 400, { message: 'Trailing slash on RESTful id in URL is not acceptable', code: 400 });
    });

    describe('/_components/:name/schema', function () {
      const path = this.title;

      beforeEach(function () {
        return apiAccepts.beforeEachTest({ sandbox, hostname });
      });

      acceptsJson(path, {name: 'invalid'}, 404);
      acceptsJson(path, {name: 'valid'}, 405, { allow:['get'], code: 405, message: 'Method PUT not allowed' });
      acceptsJson(path, {name: 'missing'}, 405, { allow:['get'], code: 405, message: 'Method PUT not allowed' });
    });

    describe('/_components/:name@:version', function () {
      const path = this.title,
        version = 'def';

      beforeEach(function () {
        return apiAccepts.beforeEachTest({ sandbox, hostname });
      });

      acceptsJson(path, {name: 'invalid', version}, 404, { code: 404, message: 'Not Found' });
      acceptsJson(path, {name: 'valid', version}, 200, {});
      acceptsJson(path, {name: 'missing', version}, 200, {});

      acceptsJsonBody(path, {name: 'invalid', version}, {}, 404, { code: 404, message: 'Not Found' });
      acceptsJsonBody(path, {name: 'valid', version}, data, 200, data);
      acceptsJsonBody(path, {name: 'missing', version}, data, 200, data);
      acceptsJsonBody(path, {name: 'valid', version}, cascadingData(), 200, cascadingReturnData());

      cascades(path, {name: 'valid', version}, cascadingData(), cascadingTarget, cascadingDeepData);

      // block with _ref at root of object
      acceptsJsonBody(path, {name: 'valid', version}, _.assign({_ref: 'whatever'}, data), 400, {message: 'Reference (_ref) at root of object is not acceptable', code: 400});

      // deny trailing slashes
      acceptsJsonBody(path + '/', {name: 'valid', version}, data, 400, { message: 'Trailing slash on RESTful id in URL is not acceptable', code: 400 });
    });

    describe('/_components/:name/instances', function () {
      const path = this.title;

      beforeEach(function () {
        return apiAccepts.beforeEachTest({ sandbox, hostname });
      });

      acceptsJson(path, {name: 'invalid'}, 404, { code: 404, message: 'Not Found' });
      acceptsJson(path, {name: 'valid'}, 405, { allow:['get', 'post'], code: 405, message: 'Method PUT not allowed' });
      acceptsJson(path, {name: 'missing'}, 405, { allow:['get', 'post'], code: 405, message: 'Method PUT not allowed' });

      acceptsJsonBody(path, {name: 'invalid'}, {}, 404, { code: 404, message: 'Not Found' });
      acceptsJsonBody(path, {name: 'valid'}, data, 405, { allow:['get', 'post'], code: 405, message: 'Method PUT not allowed' });
      acceptsJsonBody(path, {name: 'missing'}, data, 405, { allow:['get', 'post'], code: 405, message: 'Method PUT not allowed' });
    });

    describe('/_components/:name/instances/:id', function () {
      const path = this.title;

      beforeEach(function () {
        return apiAccepts.beforeEachTest({ sandbox, hostname });
      });

      acceptsJson(path, {name: 'invalid', id: 'valid'}, 404, { code: 404, message: 'Not Found' });
      acceptsJson(path, {name: 'valid', id: 'valid'}, 200, {});
      acceptsJson(path, {name: 'valid', id: 'missing'}, 200, {});

      acceptsJsonBody(path, {name: 'invalid', id: 'valid'}, {}, 404, { code: 404, message: 'Not Found' });
      acceptsJsonBody(path, {name: 'valid', id: 'valid'}, data, 200, data);
      acceptsJsonBody(path, {name: 'missing', id: 'missing'}, data, 200, data);
      acceptsJsonBody(path, {name: 'valid'}, cascadingData(), 200, cascadingReturnData());

      cascades(path, {name: 'valid', id: 'valid'}, cascadingData(), cascadingTarget, cascadingDeepData);

      // block with _ref at root of object
      acceptsJsonBody(path, {name: 'valid', id: 'valid'}, _.assign({_ref: 'whatever'}, data), 400, {message: 'Reference (_ref) at root of object is not acceptable', code: 400});

      // deny trailing slashes
      acceptsJsonBody(path + '/', {name: 'valid', id: 'valid'}, data, 400, { message: 'Trailing slash on RESTful id in URL is not acceptable', code: 400 });
    });

    describe('/_components/:name/instances/:id.json', function () {
      const path = this.title;

      beforeEach(function () {
        return apiAccepts.beforeEachTest({ sandbox, hostname });
      });

      acceptsJson(path, {name: 'invalid', id: 'valid'}, 404, { code: 404, message: 'Not Found' });
      acceptsJson(path, {name: 'valid', id: 'valid'}, 200, {});
      acceptsJson(path, {name: 'valid', id: 'missing'}, 200, {});

      acceptsJsonBody(path, {name: 'invalid', id: 'valid'}, {}, 404, { code: 404, message: 'Not Found' });
      acceptsJsonBody(path, {name: 'valid', id: 'valid'}, data, 200, data);

      acceptsJsonBody(path, {name: 'missing', id: 'missing'}, data, 404, { code: 404, message: 'Not Found' });

      acceptsJsonBody(path, {name: 'valid'}, cascadingData(), 200, cascadingData());

      cascades(path, {name: 'valid', id: 'valid'}, cascadingData(), cascadingTarget, cascadingDeepData);

      // block with _ref at root of object
      acceptsJsonBody(path, {name: 'valid', id: 'valid'}, _.assign({_ref: 'whatever'}, data), 400, {message: 'Reference (_ref) at root of object is not acceptable', code: 400});
    });

    describe('/_components/:name/instances/:id@:version', function () {
      let path = this.title,
        version = 'scheduled';

      beforeEach(function () {
        return apiAccepts.beforeEachTest({ sandbox, hostname, pathsAndData: {
          '/_components/valid/instances/valid': data
        }});
      });

      acceptsJson(path, {name: 'invalid', version, id: 'valid'}, 404, { code: 404, message: 'Not Found' });
      acceptsJson(path, {name: 'valid', version, id: 'valid'}, 200, {});
      acceptsJson(path, {name: 'valid', version, id: 'missing'}, 200, {});

      acceptsJsonBody(path, {name: 'invalid', version, id: 'valid'}, {}, 404, { code: 404, message: 'Not Found' });
      acceptsJsonBody(path, {name: 'valid', version, id: 'valid'}, data, 200, data);
      acceptsJsonBody(path, {name: 'missing', version, id: 'missing'}, data, 200, data);
      acceptsJsonBody(path, {name: 'valid', version, id: 'valid'}, cascadingData(), 200, cascadingReturnData());

      cascades(path, {name: 'valid', version, id: 'valid'}, cascadingData(), cascadingTarget, cascadingDeepData);

      // published version
      version = 'published';
      acceptsJsonBody(path, {name: 'valid', version, id: 'valid'}, data, 200, data);
      acceptsJsonBody(path, {name: 'valid', version, id: 'valid'}, cascadingData(version), 200, cascadingReturnData(version));
      cascades(path, {name: 'valid', version, id: 'valid'}, cascadingData(version), addVersion(version), cascadingDeepData);

      // published blank data will publish @published
      acceptsJsonBody(path, {name: 'valid', version, id: 'valid'}, data, 200, data);

      // block with _ref at root of object
      acceptsJsonBody(path, {name: 'valid', version, id: 'valid'}, _.assign({_ref: 'whatever'}, data), 400, {message: 'Reference (_ref) at root of object is not acceptable', code: 400});

      // deny trailing slashes
      acceptsJsonBody(path + '/', {name: 'valid', version, id: 'valid'}, data, 400, { message: 'Trailing slash on RESTful id in URL is not acceptable', code: 400 });
    });
  });
});
