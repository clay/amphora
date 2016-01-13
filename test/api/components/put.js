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
      referencedInternalTarget = 'localhost.example.com/components/valid/instances/validDeep',
      getInternalTargetWithVersion = _.partial(replaceVersion, referencedInternalTarget),
      // this data should cascade into two components
      cascadingData = function (version) { return {a: 'b', c: {_ref: getInternalTargetWithVersion(version), d: 'e'}}; },
      // this data references another component
      referencingData = function (version) { return {a: 'b', c: {_ref: getInternalTargetWithVersion(version)}}; },
      // this data is created from cascading
      cascadedData = {d: 'e'};

    beforeEach(function () {
      sandbox = sinon.sandbox.create();
    });

    afterEach(function () {
      sandbox.restore();
    });

    describe('/components', function () {
      var path = this.title;

      beforeEach(function () {
        return apiAccepts.beforeEachTest({ sandbox: sandbox, hostname: hostname });
      });

      acceptsJson(path, {}, 405, { allow:['get'], code: 405, message: 'Method PUT not allowed' });
      acceptsJsonBody(path, {}, {}, 405, { allow:['get'], code: 405, message: 'Method PUT not allowed' });
      acceptsHtml(path, {}, 405);
    });

    describe('/components/:name', function () {
      var path = this.title;

      beforeEach(function () {
        return apiAccepts.beforeEachTest({ sandbox: sandbox, hostname: hostname });
      });

      acceptsJson(path, {name: 'invalid'}, 404, { code: 404, message: 'Not Found' });
      acceptsJson(path, {name: 'valid'}, 200, {});
      acceptsJson(path, {name: 'missing'}, 200, {});

      acceptsJsonBody(path, {name: 'invalid'}, {}, 404, { code: 404, message: 'Not Found' });
      acceptsJsonBody(path, {name: 'valid'}, data, 200, data);
      acceptsJsonBody(path, {name: 'missing'}, data, 200, data);
      acceptsJsonBody(path, {name: 'valid'}, cascadingData(), 200, referencingData());

      acceptsHtml(path, {name: 'invalid'}, 404);
      acceptsHtml(path, {name: 'valid'}, 406);
      acceptsHtml(path, {name: 'missing'}, 406);

      cascades(path, {name: 'valid'}, cascadingData(), {
        path: referencedInternalTarget,
        data: cascadedData
      });

      // block with _ref at root of object
      acceptsJsonBody(path, {name: 'valid'}, _.assign({_ref: 'whatever'}, data), 400, {message: 'Reference (_ref) at root of object is not acceptable', code: 400});
    });

    describe('/components/:name/schema', function () {
      var path = this.title;

      beforeEach(function () {
        return apiAccepts.beforeEachTest({ sandbox: sandbox, hostname: hostname });
      });

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

      beforeEach(function () {
        return apiAccepts.beforeEachTest({ sandbox: sandbox, hostname: hostname });
      });

      acceptsJson(path, {name: 'invalid', version: version}, 404, { code: 404, message: 'Not Found' });
      acceptsJson(path, {name: 'valid', version: version}, 200, {});
      acceptsJson(path, {name: 'missing', version: version}, 200, {});

      acceptsJsonBody(path, {name: 'invalid', version: version}, {}, 404, { code: 404, message: 'Not Found' });
      acceptsJsonBody(path, {name: 'valid', version: version}, data, 200, data);
      acceptsJsonBody(path, {name: 'missing', version: version}, data, 200, data);
      acceptsJsonBody(path, {name: 'valid', version: version}, cascadingData(), 200, referencingData());

      acceptsHtml(path, {name: 'invalid', version: version}, 404);
      acceptsHtml(path, {name: 'valid', version: version}, 406);
      acceptsHtml(path, {name: 'missing', version: version}, 406);

      cascades(path, {name: 'valid', version: version}, cascadingData(), {
        path: referencedInternalTarget,
        data: cascadedData
      });

      // block with _ref at root of object
      acceptsJsonBody(path, {name: 'valid', version: version}, _.assign({_ref: 'whatever'}, data), 400, {message: 'Reference (_ref) at root of object is not acceptable', code: 400});
    });

    describe('/components/:name/instances', function () {
      var path = this.title;

      beforeEach(function () {
        return apiAccepts.beforeEachTest({ sandbox: sandbox, hostname: hostname });
      });

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

      beforeEach(function () {
        return apiAccepts.beforeEachTest({ sandbox: sandbox, hostname: hostname });
      });

      acceptsJson(path, {name: 'invalid', id: 'valid'}, 404, { code: 404, message: 'Not Found' });
      acceptsJson(path, {name: 'valid', id: 'valid'}, 200, {});
      acceptsJson(path, {name: 'valid', id: 'missing'}, 200, {});

      acceptsJsonBody(path, {name: 'invalid', id: 'valid'}, {}, 404, { code: 404, message: 'Not Found' });
      acceptsJsonBody(path, {name: 'valid', id: 'valid'}, data, 200, data);
      acceptsJsonBody(path, {name: 'missing', id: 'missing'}, data, 200, data);
      acceptsJsonBody(path, {name: 'valid'}, cascadingData(), 200, referencingData());

      acceptsHtml(path, {name: 'invalid', id: 'valid'}, 404);
      acceptsHtml(path, {name: 'valid', id: 'valid'}, 406);
      acceptsHtml(path, {name: 'valid', id: 'missing'}, 406);

      cascades(path, {name: 'valid', id: 'valid'}, cascadingData(), {
        path: referencedInternalTarget,
        data: cascadedData
      });

      // block with _ref at root of object
      acceptsJsonBody(path, {name: 'valid', id: 'valid'}, _.assign({_ref: 'whatever'}, data), 400, {message: 'Reference (_ref) at root of object is not acceptable', code: 400});
    });

    describe('/components/:name/instances/:id@:version', function () {
      var path = this.title,
        version = 'def';

      beforeEach(function () {
        return apiAccepts.beforeEachTest({ sandbox: sandbox, hostname: hostname, pathsAndData: {
          '/components/valid/instances/valid': data,
          '/components/valid/instances/validDeep': cascadedData,
          '/components/valid/instances/validBig': referencingData()
        }});
      });

      acceptsJson(path, {name: 'invalid', version: version, id: 'valid'}, 404, { code: 404, message: 'Not Found' });
      acceptsJson(path, {name: 'valid', version: version, id: 'valid'}, 200, {});
      acceptsJson(path, {name: 'valid', version: version, id: 'missing'}, 200, {});

      acceptsJsonBody(path, {name: 'invalid', version: version, id: 'valid'}, {}, 404, { code: 404, message: 'Not Found' });
      acceptsJsonBody(path, {name: 'valid', version: version, id: 'valid'}, data, 200, data);
      acceptsJsonBody(path, {name: 'missing', version: version, id: 'missing'}, data, 200, data);
      acceptsJsonBody(path, {name: 'valid', version: version, id: 'valid'}, cascadingData(), 200, referencingData());

      acceptsHtml(path, {name: 'invalid', version: version, id: 'valid'}, 404);
      acceptsHtml(path, {name: 'valid', version: version, id: 'valid'}, 406);
      acceptsHtml(path, {name: 'valid', version: version, id: 'missing'}, 406);

      cascades(path, {name: 'valid', version: version, id: 'valid'}, cascadingData(), {
        path: referencedInternalTarget,
        data: cascadedData
      });

      // block with _ref at root of object
      acceptsJsonBody(path, {name: 'valid', version: version, id: 'valid'}, _.assign({_ref: 'whatever'}, data), 400, {message: 'Reference (_ref) at root of object is not acceptable', code: 400});
    });

    describe('/components/:name/instances/:id@published', function () {
      var path = this.title,
        version = 'published';

      beforeEach(function () {
        return apiAccepts.beforeEachTest({ sandbox: sandbox, hostname: hostname, pathsAndData: {
          '/components/valid/instances/valid': data,
          '/components/valid/instances/validDeep': cascadedData,
          '/components/valid/instances/validBig': referencingData()
        }});
      });

      acceptsJsonBody(path, {name: 'valid', version: version, id: 'valid'}, data, 200, data);
      // takes cascading data, but returns data that only references the new cascaded component
      acceptsJsonBody(path, {name: 'valid', version: version, id: 'valid'}, cascadingData(version), 200, referencingData(version));
      // the cascaded component exists
      cascades(path, {name: 'valid', version: version, id: 'valid'}, cascadingData(version), {
        path: getInternalTargetWithVersion(version),
        data: cascadedData
      });

      // published blank data will publish @latest
      acceptsJsonBody(path, {name: 'valid', version: version, id: 'valid'}, {}, 200, data);
      // publishing blank data without a @latest will 404 because missing resource
      acceptsJsonBody(path, {name: 'valid', version: version, id: 'missing'}, {}, 404, { code: 404, message: 'Not Found' });
      // publishing blank data will change the version of internal references
      acceptsJsonBody(path, {name: 'valid', version: version, id: 'validBig'}, {}, 200, referencingData(version));
      // should cascade publishing to child components too
      cascades(path, {name: 'valid', version: version, id: 'validBig'}, {}, {
        path: getInternalTargetWithVersion(version),
        data: cascadedData
      });
    });
  });
});