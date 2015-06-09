'use strict';

var _ = require('lodash'),
  express = require('express'),
  request = require('supertest-as-promised'),
  files = require('../../lib/files'),
  fs = require('fs'),
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
 * Create a generic API test.  (shortcut)
 * @param {object} options
 * @param options.path          The path to the route, e.g. `uri/:name`
 * @param options.replacements  Replace path with a value, e.g. `uri/:name` becomes `uri/something`
 * @param options.accept        E.g. 'application/json'
 * @param options.contentType   E.g. /json/
 * @param options.body          Data to send with the request (put, post)
 * @param options.status        Expected HTTP status to be returned
 * @param options.data          Expected data to be returned
 */
function createTest(options) {
  var realPath = _.reduce(options.replacements, function (str, value, key) { return str.replace(':' + key, value); }, options.path);

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

    //if there is no extension to the url, then all endpoints should have a Vary header with Accept
    if (!options.path.match(/.*\/.*\.(.*)/)) {
      promise.expect('Vary', /Accept/);
    }

    return promise;
  });
}

/**
 * Create a generic test that accepts HTML
 * @param method
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
 * @param method
 * @returns {Function}
 */
function acceptsJsonBody(method) {
  return function (path, replacements, body, status, data) {
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

function updatesOther(method) {
  return function (path, otherPath, replacements, data) {
    var realPath = _.reduce(replacements, function (str, value, key) { return str.replace(':' + key, value); }, path),
      realOtherPath = _.reduce(replacements, function (str, value, key) { return str.replace(':' + key, value); }, otherPath);

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

  db.list({prefix: prefix, values: false, transforms: [filter({wantStrings: true}, function (str) {
    return str.indexOf('@') !== -1;
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
    var realPath = _.reduce(replacements, function (str, value, key) { return str.replace(':' + key, value); }, path);

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
            //no versions are deleted
            expect(newVersions).to.include.members(oldVersions);
            //should have one new version, not counting realPath
            expect(_.without(newVersions, realPath).length - oldVersions.length).to.be.at.least(1);
          });
      });
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
  //extra time to prime the 'requires'
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
 * Before each test, make the DB and Host consistent, and get a _new_ version of express.
 * Generic, often called by all.js.
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
    return bluebird.all(_.map(options.pathsAndData, function(data, path) {
      return db.put(path, JSON.stringify(data));
    }));
  });
}


module.exports.setApp = setApp;
module.exports.setHost = setHost;
module.exports.acceptsHtml = acceptsHtml;
module.exports.acceptsJson = acceptsJson;
module.exports.acceptsJsonBody = acceptsJsonBody;
module.exports.updatesOther = updatesOther;
module.exports.createsNewVersion = createsNewVersion;
module.exports.stubComponentPath = stubSchema;
module.exports.beforeTesting = beforeTesting;
module.exports.beforeEachTest = beforeEachTest;