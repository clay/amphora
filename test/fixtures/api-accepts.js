'use strict';

var _ = require('lodash'),
  express = require('express'),
  request = require('supertest-as-promised'),
  files = require('../../lib/files'),
  components = require('../../lib/services/components'),
  routes = require('../../lib/routes'),
  db = require('../../lib/services/db'),
  bluebird = require('bluebird'),
  multiplex = require('multiplex-templates'),
  log = require('../../lib/log'),
  schema = require('../../lib/schema'),
  expect = require('chai').expect,
  filter = require('through2-filter'),
  app,
  host;

/**
 * @param {object} replacements
 * @param {string} path
 * @returns {string}
 */
function getRealPath(replacements, path) {
  return _.reduce(replacements, function (str, value, key) { return str.replace(':' + key, value); }, path);
}

/**
 * Create a generic API test.  (shortcut)
 * @param {object} options
 * @param {string} options.path          The path to the route, e.g. `uri/:name`
 * @param {string} options.replacements  Replace path with a value, e.g. `uri/:name` becomes `uri/something`
 * @param {string} options.accept        E.g. 'application/json'
 * @param {string} options.contentType   E.g. /json/
 * @param {string} options.body          Data to send with the request (put, post)
 * @param {number} options.status        Expected HTTP status to be returned
 * @param {object} options.data          Expected data to be returned
 */
function createTest(options) {
  var realPath = getRealPath(options.replacements, options.path);

  it(options.description, function () {
    var promise = request(app)[options.method](realPath);


    if (options.body !== undefined) {
      promise = promise.send(options.body);
    }

    promise = promise
      .type(options.accept)
      .set('Accept', options.accept)
      .set('Host', host);

    promise = promise.expect('Content-Type', options.contentType)
      .expect(options.status);

    if (options.data !== undefined) {
      promise = promise.expect(options.data);
    }

    // if there is no extension to the url, then all endpoints should have a Vary header with Accept
    if (!options.path.match(/.*\/.*\.(.*)/)) {
      promise.expect('Vary', /Accept/);
    }

    return promise;
  });
}

/**
 * Create a generic test that accepts HTML
 * @param {string} method
 * @returns {Function}
 */
function acceptsHtml(method) {
  return function (path, replacements, status, data) {
    createTest({
      description: JSON.stringify(replacements) + ' accepts html',
      path: path,
      method: method,
      replacements: replacements,
      data: data,
      status: status,
      accept: 'text/html',
      contentType: /html/
    });
  };
}

/**
 * Create a generic test that accepts JSON with a BODY
 * @param {string} method
 * @returns {Function}
 */
function acceptsJsonBody(method) {
  return function (path, replacements, body, status, data) { // eslint-disable-line
    createTest({
      description: JSON.stringify(replacements) + ' accepts json with body ' + JSON.stringify(body),
      path: path,
      method: method,
      replacements: replacements,
      body: body,
      data: data,
      status: status,
      accept: 'application/json',
      contentType: /json/
    });
  };
}

/**
 * Create a generic test that accepts JSON
 * @param {String} method
 * @returns {Function}
 */
function acceptsJson(method) {
  return function (path, replacements, status, data) {
    createTest({
      description: JSON.stringify(replacements) + ' accepts json',
      path: path,
      method: method,
      replacements: replacements,
      data: data,
      status: status,
      accept: 'application/json',
      contentType: /json/
    });
  };
}

/**
 * Create a generic test that accepts JSON with a BODY
 * @param {string} method
 * @returns {Function}
 */
function acceptsTextBody(method) {
  return function (path, replacements, body, status, data) { // eslint-disable-line
    createTest({
      description: JSON.stringify(replacements) + ' accepts text with body ' + body,
      path: path,
      method: method,
      replacements: replacements,
      body: body,
      data: data,
      status: status,
      accept: 'text/plain',
      contentType: /text/
    });
  };
}

/**
 * Create a generic test that accepts JSON
 * @param {String} method
 * @returns {Function}
 */
function acceptsText(method) {
  return function (path, replacements, status, data) {
    createTest({
      description: JSON.stringify(replacements) + ' accepts text',
      path: path,
      method: method,
      replacements: replacements,
      data: data,
      status: status,
      accept: 'text/plain',
      contentType: /text/
    });
  };
}

function updatesOther(method) {
  return function (path, otherPath, replacements, data) {
    var realPath = getRealPath(replacements, path),
      realOtherPath = getRealPath(replacements, otherPath);

    it(JSON.stringify(replacements) + ' updates other ' + otherPath, function () {
      return request(app)[method](realPath)
        .send(data)
        .type('application/json')
        .set('Accept', 'application/json')
        .set('Host', host)
        .then(function () {
          return db.get(realOtherPath).then(JSON.parse).then(function (result) {
            expect(result).to.deep.equal(data);
          });
        });
    });
  };
}

function getVersions(ref) {
  var str = '',
    errors = [],
    deferred = bluebird.defer(),
    prefix = ref.split('@')[0];

  db.list({prefix: prefix, values: false, transforms: [filter({wantStrings: true}, function (possibleVersion) {
    return possibleVersion.indexOf('@') !== -1;
  })]})
    .on('data', function (data) {
      str += data;
    }).on('error', function (err) {
      errors.push(err);
    }).on('end', function () {
      if (errors.length) {
        deferred.reject(_.first(errors));
      } else {
        deferred.resolve(JSON.parse(str));
      }
    });

  return deferred.promise;
}

function createsNewVersion(method) {
  return function (path, replacements, data) {
    var realPath = getRealPath(replacements, path);

    it(realPath + ' creates new version', function () {
      return getVersions(realPath).then(function (oldVersions) {
        return request(app)[method](realPath)
          .send(data)
          .type('application/json')
          .set('Accept', 'application/json')
          .set('Host', host)
          .expect(200)
          .expect(data)
          .then(function () {
            return getVersions(realPath);
          }).then(function (newVersions) {
            // no versions are deleted
            expect(newVersions).to.include.members(oldVersions);
            // should have one new version, not counting realPath
            expect(_.without(newVersions, realPath).length - oldVersions.length).to.be.at.least(1);
          });
      });
    });
  };
}

/**
 * Expect deep data to exist after cascading operation
 * @param {string} method
 * @returns {Function}
 */
function cascades(method) {
  return function (path, replacements, data, cascadingTarget, cascadingDeepData) { // eslint-disable-line
    var realPath = getRealPath(replacements, path);

    it(realPath + ' cascades to ' + cascadingTarget, function () {
      return request(app)[method](realPath)
        .send(data)
        .type('application/json')
        .set('Accept', 'application/json')
        .set('Host', host)
        .expect(200)
        .then(function () {
          // expect deep data to now exist
          return db.get(cascadingTarget).then(JSON.parse).then(function (result) {
            expect(result).to.deep.equal(cascadingDeepData);
          });
        });
    });
  };
}

/**
 * Expect the data, plus some reference.
 * @param {object} data
 * @returns {Function}
 */
function expectDataPlusRef(data) {
  return function (res) {
    expect(res.body._ref.length > 0).to.equal(true);
    delete res.body._ref;
    expect(res.body).to.deep.equal(data);
  };
}

/**
 * Expect all references in returned data to be @published
 * @returns {Function}
 */
function expectAllRefsArePublished() {
  return function (res) {
    var data = res.body,
      refs = _.listDeepObjects(data, '_ref');

    _.each(refs, function (ref) {
      expect(ref.indexOf('@published') > -1).to.equal(true);
    });
  };
}

/**
 * All _refs are in objects with a size of one.
 * @returns {Function}
 */
function expectCleanReferences() {
  return function (res) {
    var data = res.body,
      refs = _.listDeepObjects(data, '_ref');

    _.each(refs, function (obj) {
      expect(_.size(obj)).to.equal(1);
    });
  };
}

function setApp(value) {
  app = value;
}

function setHost(value) {
  host = value;
}

function stubFiles(sandbox) {
  var stubGetComponentPath = sandbox.stub(files, 'getComponentPath');

  stubGetComponentPath.withArgs('valid').returns('validThing');
  stubGetComponentPath.withArgs('missing').returns('missingThing');
  stubGetComponentPath.withArgs('invalid').returns(null);
}

function stubSchema(sandbox) {
  var stubGet = sandbox.stub(schema, 'getSchema');

  stubGet.withArgs('validThing').returns({some: 'schema', thatIs: 'valid'});
  stubGet.withArgs('missingThing').throws(new Error('File not found.'));
  return sandbox;
}

function stubGetTemplate(sandbox) {
  var stub = sandbox.stub(components, 'getTemplate');

  stub.withArgs('valid').returns('some/valid/template.nunjucks');
  stub.withArgs('layout').returns('some/valid/template.for.layout.nunjucks');
  return sandbox;
}

function stubMultiplexRender(sandbox) {
  var template = _.template('<valid><% print(JSON.stringify(obj)) %></valid>');

  sandbox.stub(multiplex, 'render', function (name, data) {
    return template(_.omit(data, 'state', 'getTemplate', 'locals', 'site'));
  });
  return sandbox;
}

function stubLogging(sandbox) {
  sandbox.stub(log);
  return sandbox;
}

/**
 * Before starting testing at all, prepare certain things to make sure our performance testing is accurate.
 */

function beforeTesting(suite, hostname, data) {
  // extra time to prime the 'requires'
  suite.timeout(500);

  app = express();
  routes.addHost(app, hostname);

  return db.clear().then(function () {
    return bluebird.all([
      request(app).put('/components/valid', JSON.stringify(data)),
      request(app).get('/components/valid'),
      request(app).post('/components/valid', JSON.stringify(data)),
      request(app).delete('/components/valid')
    ]);
  });
}


/**
 * Generic before each test, make the DB and Host consistent, and get a _new_ version of express.
 *
 * Yes, brand new, for every single test.
 *
 * @param {Object} options
 * @param {Object} options.sandbox
 * @param {String} options.hostname
 * @param {Object} options.pathsAndData E.g. `{'path/one': data1, 'path/two': data2}`
 * @returns {Promise}
 */
function beforeEachTest(options) {
  app = express();
  host = options.hostname;
  stubFiles(options.sandbox);
  stubSchema(options.sandbox);
  stubGetTemplate(options.sandbox);
  stubMultiplexRender(options.sandbox);
  stubLogging(options.sandbox);
  routes.addHost(app, options.hostname);

  return db.clear().then(function () {
    return bluebird.all(_.map(options.pathsAndData, function (data, path) {

      if (typeof data === 'object') {
        data = JSON.stringify(data);
      }

      return db.put(path, data);
    }));
  });
}

/**
 * Before each test, make the DB and Host consistent, and get a _new_ version of express.
 *
 * Yes, brand new, for every single test.
 *
 * @param {string} sandbox
 * @param {string} hostname
 * @param {object} data
 * @returns {Promise}
 */
function beforeEachComponentTest(sandbox, hostname, data) {
  return beforeEachTest({
    sandbox: sandbox,
    hostname: hostname,
    pathsAndData: {
      '/components/valid': data,
      '/components/valid/instances/valid': data,
      '/components/valid/instances/valid@valid': data
    }
  });
}

/**
 * Before each test, make the DB and Host consistent, and get a _new_ version of express.
 *
 * Yes, brand new, for every single test.
 *
 * @param {string} sandbox
 * @param {string} hostname
 * @param {object} pageData
 * @param {object} layoutData
 * @param {object} firstLevelComponentData
 * @param {object} secondLevelComponentData
 * @returns {Promise}
 */
function beforeEachPageTest(sandbox, hostname, pageData, layoutData, firstLevelComponentData, secondLevelComponentData) { // eslint-disable-line
  return beforeEachTest({
    sandbox: sandbox,
    hostname: hostname,
    pathsAndData: {
      '/components/layout': layoutData,
      '/components/layout@valid': layoutData,
      '/components/layoutCascading': firstLevelComponentData,
      '/components/valid': firstLevelComponentData,
      '/components/valid@valid': firstLevelComponentData,
      '/components/validCascading': firstLevelComponentData,
      '/components/validCascading@valid': firstLevelComponentData,
      '/components/validDeep': secondLevelComponentData,
      '/components/validDeep@valid': secondLevelComponentData,
      '/pages/valid': pageData,
      '/pages/valid@valid': pageData
    }
  });
}

/**
 * Before each test, make the DB and Host consistent, and get a _new_ version of express.
 *
 * Yes, brand new, for every single test.
 *
 * @param {string} sandbox
 * @param {string} hostname
 * @param {object} data
 * @returns {Promise}
 */
function beforeEachUriTest(sandbox, hostname, data) {
  return beforeEachTest({
    sandbox: sandbox,
    hostname: hostname,
    pathsAndData: {
      '/components/valid': data,
      '/components/valid/instances/valid': data,
      '/components/valid/instances/valid@valid': data,
      '/pages/valid': data,
      '/pages/valid@valid': data,
      '/uris/valid': data
    }
  });
}

/**
 * Before each test, make the DB and Host consistent, and get a _new_ version of express.
 *
 * Yes, brand new, for every single test.
 *
 * @param {string} sandbox
 * @param {string} hostname
 * @param {object} data
 * @returns {Promise}
 */
function beforeEachListTest(sandbox, hostname, data) {
  return beforeEachTest({
    sandbox: sandbox,
    hostname: hostname,
    pathsAndData: {'/lists/valid': data}
  });
}


module.exports.setApp = setApp;
module.exports.setHost = setHost;
module.exports.acceptsHtml = acceptsHtml;
module.exports.acceptsJson = acceptsJson;
module.exports.acceptsJsonBody = acceptsJsonBody;
module.exports.acceptsText = acceptsText;
module.exports.acceptsTextBody = acceptsTextBody;
module.exports.updatesOther = updatesOther;
module.exports.createsNewVersion = createsNewVersion;
module.exports.cascades = cascades;
module.exports.expectAllRefsArePublished = expectAllRefsArePublished;
module.exports.expectCleanReferences = expectCleanReferences;
module.exports.expectDataPlusRef = expectDataPlusRef;
module.exports.beforeTesting = beforeTesting;
module.exports.beforeEachComponentTest = beforeEachComponentTest;
module.exports.beforeEachPageTest = beforeEachPageTest;
module.exports.beforeEachUriTest = beforeEachUriTest;
module.exports.beforeEachListTest = beforeEachListTest;
