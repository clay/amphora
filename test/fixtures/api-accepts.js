'use strict';

var _ = require('lodash'),
  express = require('express'),
  request = require('supertest-as-promised'),
  files = require('../../lib/files'),
  references = require('../../lib/references'),
  components = require('../../lib/services/components'),
  routes = require('../../lib/routes'),
  db = require('../../lib/services/db'),
  bluebird = require('bluebird'),
  multiplex = require('multiplex-templates'),
  log = require('../../lib/log'),
  expect = require('chai').expect,
  app,
  host;

/**
 * Create a generic API test.  (shortcut)
 * @param options
 */
function createTest(options) {
  var realPath = _.reduce(options.replacements, function (str, value, key) { return str.replace(':' + key, value); }, options.path);

  it(options.description, function () {
    var promise = request(app)[options.method](realPath);


    if (options.body) {
      promise = promise.send(options.body);
    }

    promise = promise
      .type(options.accept)
      .set('Accept', options.accept)
      .set('Host', host);

    promise = promise.expect('Content-Type', options.contentType)
      .expect(options.status);

    if (options.data) {
      promise = promise.expect(options.data);
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
  return function (path, replacements, status) {
    createTest({
      description: JSON.stringify(replacements) + ' accepts html',
      path: path,
      method: method,
      replacements: replacements,
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
 * Create a generic test that accepts HTML
 * @param method
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

function updatesTag(method) {
  return function (path, replacements, tag, data) {
    var realPath = _.reduce(replacements, function (str, value, key) { return str.replace(':' + key, value); }, path);

    it(JSON.stringify(replacements) + ' updates tag ' + tag, function () {
      return request(app)[method](realPath)
        .send(data)
        .type('application/json')
        .set('Accept', 'application/json')
        .set('Host', host)
        .then(function () {
          return db.get(realPath + '@' + tag).then(function (result) {
            expect(result).to.deep.equal(data);
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

function stubComponentPath(sandbox) {
  var stub = sandbox.stub(files, 'getComponentPath');
  stub.withArgs('valid').returns('validThing');
  stub.withArgs('missing').returns('missingThing');
  stub.withArgs('invalid').returns(null);
  return sandbox;
}

function stubGetTemplate(sandbox) {
  var stub = sandbox.stub(components, 'getTemplate');
  stub.withArgs('valid').returns('some/valid/template.nunjucks');
  return sandbox;
}

function stubMultiplexRender(sandbox) {
  var stub = sandbox.stub(multiplex, 'render');
  stub.withArgs('some/valid/template.nunjucks').returns('<valid></valid>');
  return sandbox;
}

function stubLogging(sandbox) {
  //sandbox.stub(log);
  return sandbox;
}

/**
 * Before each test, make the DB and Host consistent, and get a _new_ version of express.
 *
 * Yes, brand new, for every single test.
 *
 * @param sandbox
 * @param hostname
 * @param data
 * @returns {Promise}
 */
function beforeEachComponentTest(sandbox, hostname, data) {
  app = express();
  host = hostname;
  stubComponentPath(sandbox);
  stubGetTemplate(sandbox);
  stubMultiplexRender(sandbox);
  stubLogging(sandbox);
  routes.addHost(app, hostname);

  return db.clear().then(function () {
    return bluebird.all([
      db.put('/components/valid', JSON.stringify(data)),
      db.put('/components/valid/instances/valid', JSON.stringify(data)),
      db.put('/components/valid/instances/valid@valid', JSON.stringify(data))
    ]);
  });
}

/**
 * Before each test, make the DB and Host consistent, and get a _new_ version of express.
 *
 * Yes, brand new, for every single test.
 *
 * @param sandbox
 * @param hostname
 * @param data
 * @returns {Promise}
 */
function beforeEachPageTest(sandbox, hostname, data) {
  app = express();
  host = hostname;
  stubComponentPath(sandbox);
  stubGetTemplate(sandbox);
  stubMultiplexRender(sandbox);
  stubLogging(sandbox);
  routes.addHost(app, hostname);

  return db.clear().then(function () {
    return bluebird.all([
      db.put('/components/valid', JSON.stringify(data)),
      db.put('/components/valid/instances/valid', JSON.stringify(data)),
      db.put('/components/valid/instances/valid@valid', JSON.stringify(data)),
      db.put('/pages/valid', JSON.stringify(data)),
      db.put('/pages/valid@valid', JSON.stringify(data))
    ]);
  });
}

/**
 * Before each test, make the DB and Host consistent, and get a _new_ version of express.
 *
 * Yes, brand new, for every single test.
 *
 * @param sandbox
 * @param hostname
 * @param data
 * @returns {Promise}
 */
function beforeEachUriTest(sandbox, hostname, data) {
  app = express();
  host = hostname;
  stubComponentPath(sandbox);
  stubGetTemplate(sandbox);
  stubMultiplexRender(sandbox);
  stubLogging(sandbox);
  routes.addHost(app, hostname);

  return db.clear().then(function () {
    return bluebird.all([
      db.put('/components/valid', JSON.stringify(data)),
      db.put('/components/valid/instances/valid', JSON.stringify(data)),
      db.put('/components/valid/instances/valid@valid', JSON.stringify(data)),
      db.put('/pages/valid', JSON.stringify(data)),
      db.put('/pages/valid@valid', JSON.stringify(data)),
      db.put('/uris/valid', JSON.stringify(data))
    ]);
  });
}


module.exports.setApp = setApp;
module.exports.setHost = setHost;
module.exports.acceptsHtml = acceptsHtml;
module.exports.acceptsJson = acceptsJson;
module.exports.acceptsJsonBody = acceptsJsonBody;
module.exports.updatesTag = updatesTag;
module.exports.stubComponentPath = stubComponentPath;
module.exports.beforeEachComponentTest = beforeEachComponentTest;
module.exports.beforeEachPageTest = beforeEachPageTest;
module.exports.beforeEachUriTest = beforeEachUriTest;