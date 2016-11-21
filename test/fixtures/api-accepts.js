'use strict';

const _ = require('lodash'),
  express = require('express'),
  request = require('supertest-as-promised'),
  files = require('../../lib/files'),
  components = require('../../lib/services/components'),
  routes = require('../../lib/routes'),
  db = require('../../lib/services/db'),
  bluebird = require('bluebird'),
  multiplex = require('multiplex-templates'),
  log = require('../../lib/services/log'),
  schema = require('../../lib/schema'),
  siteService = require('../../lib/services/sites'),
  expect = require('chai').expect,
  filter = require('through2-filter'),
  uid = require('../../lib/uid');
let app, host;

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
 * @param {object} options.replacements  Replace path with a value, e.g. `uri/:name` becomes `uri/something`
 * @param {string} options.accept        E.g. 'application/json'
 * @param {string|regex} options.contentType   E.g. /json/
 * @param {object|string} options.body          Data to send with the request (put, post)
 * @param {number} options.status        Expected HTTP status to be returned
 * @param {object|string} options.data          Expected data to be returned
 */
function createTest(options) {
  const realPath = getRealPath(options.replacements, options.path);

  it(options.description, function () {
    let promise = request(app)[options.method](realPath);

    if (options.body !== undefined) {
      promise = promise.send(options.body);
    }

    promise = promise
      .type(options.clientType || options.accept) // acceptsHtmlBody sets a different client type
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
 * Create a generic test that accepts HTML with a BODY
 * @param {string} method
 * @returns {Function}
 */
function acceptsHtmlBody(method) {
  // eslint-disable-next-line
  return function (path, replacements, body, status, data) {
    createTest({
      description: JSON.stringify(replacements) + ' accepts html with body ' + JSON.stringify(body),
      path,
      method,
      replacements,
      body,
      data,
      status,
      clientType: 'application/json', // type to send in request
      accept: 'text/html', // accept header
      contentType: /html/ // type that should be returned
    });
  };
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
      path,
      method,
      replacements,
      data,
      status,
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
  // eslint-disable-next-line
  return function (path, replacements, body, status, data) {
    createTest({
      description: JSON.stringify(replacements) + ' accepts json with body ' + JSON.stringify(body),
      path,
      method,
      replacements,
      body,
      data,
      status,
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
      path,
      method,
      replacements,
      data,
      status,
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
  // eslint-disable-next-line
  return function (path, replacements, body, status, data) {
    createTest({
      description: JSON.stringify(replacements) + ' accepts text with body ' + body,
      path,
      method,
      replacements,
      body,
      data,
      status,
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
      path,
      method,
      replacements,
      data,
      status,
      accept: 'text/plain',
      contentType: /text/
    });
  };
}

function updatesOther(method) {
  return function (path, otherPath, replacements, data) {
    const realPath = getRealPath(replacements, path),
      realOtherPath = getRealPath(replacements, otherPath);

    it(JSON.stringify(replacements) + ' updates other ' + otherPath, function () {
      return request(app)[method](realPath)
        .send(data)
        .type('application/json')
        .set('Accept', 'application/json')
        .set('Host', host)
        .then(function () {
          return db.get(host + realOtherPath).then(JSON.parse).then(function (result) {
            expect(result).to.deep.equal(data);
          });
        });
    });
  };
}

/**
 * @param {string} ref
 * @returns {Promise}
 */
function getVersions(ref) {
  let str = '',
    errors = [],
    deferred = bluebird.defer(),
    prefix = ref.split('@')[0];

  db.list({prefix, values: false, transforms: [filter({wantStrings: true}, function (str) {
    return str.indexOf('@') !== -1;
  })]})
    .on('data', function (data) {
      str += data;
    }).on('error', function (err) {
      errors.push(err);
    }).on('end', function () {
      if (errors.length) {
        deferred.reject(_.head(errors));
      } else {
        deferred.resolve(JSON.parse(str));
      }
    });

  return deferred.promise;
}

function createsNewVersion(method) {
  return function (path, replacements, data) {
    const realPath = getRealPath(replacements, path);

    it(realPath + ' creates new version', function () {
      return getVersions(host + realPath).then(function (oldVersions) {
        return request(app)[method](realPath)
          .send(data)
          .type('application/json')
          .set('Accept', 'application/json')
          .set('Host', host)
          .expect(200)
          .expect(data)
          .then(function () {
            return getVersions(host + realPath);
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
  // eslint-disable-next-line
  return function (path, replacements, data, cascadingTarget, cascadingData) {
    const realPath = getRealPath(replacements, path);

    it(realPath + ' cascades to ' + cascadingTarget, function () {
      return request(app)[method](realPath)
        .send(data)
        .type('application/json')
        .set('Accept', 'application/json')
        .set('Host', host)
        .expect(200)
        .then(function () {
          // expect cascading data to now exist
          return db.get(cascadingTarget).then(JSON.parse).then(function (result) {
            expect(result).to.deep.equal(cascadingData);
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

function setApp(value) {
  app = value;
}

function setHost(value) {
  host = value;
}

function stubSiteConfig(sandbox) {
  sandbox.stub(siteService, 'sites').returns({
    example: {
      host,
      path: '/',
      slug: 'example',
      assetDir: 'public',
      assetPath: '/'
    }
  });
}

function stubFiles(sandbox) {
  sandbox.stub(files, 'getComponentPath');

  files.getComponentPath.withArgs('valid').returns('validThing');
  files.getComponentPath.withArgs('missing').returns('missingThing');
  files.getComponentPath.withArgs('invalid').returns(null);

  sandbox.stub(files, 'fileExists');
  files.fileExists.withArgs('public').returns(true);
}

function stubSchema(sandbox) {
  const stubGet = sandbox.stub(schema, 'getSchema');

  stubGet.withArgs('validThing').returns({some: 'schema', thatIs: 'valid'});
  stubGet.withArgs('missingThing').throws(new Error('File not found.'));
  return sandbox;
}

function stubGetTemplate(sandbox) {
  const stub = sandbox.stub(components, 'getTemplate');

  stub.withArgs('valid').returns('some/valid/template.nunjucks');
  stub.withArgs('layout').returns('some/valid/template.for.layout.nunjucks');
  return sandbox;
}

function stubMultiplexRender(sandbox) {
  const template = _.template('<valid><% print(JSON.stringify(obj)) %></valid>');

  sandbox.stub(multiplex, 'render', function (name, data) {
    return template(_.omit(data, 'state', 'getTemplate', 'locals', 'site'));
  });
  return sandbox;
}

function stubLogging(sandbox) {
  sandbox.stub(log);
  return sandbox;
}

function stubUid(sandbox) {
  sandbox.stub(uid);
  uid.get.returns('some-uid');
  return sandbox;
}

/**
 * Before starting testing at all, prepare certain things to make sure our performance testing is accurate.
 */

function beforeTesting(suite, options) {
  // extra time to prime the 'requires'
  suite.timeout(500);

  app = express();
  host = options.hostname;
  stubSiteConfig(options.sandbox);
  stubFiles(options.sandbox);
  stubSchema(options.sandbox);
  stubGetTemplate(options.sandbox);
  stubMultiplexRender(options.sandbox);
  stubLogging(options.sandbox);
  stubUid(options.sandbox);
  routes.addHost({
    router: app,
    hostname: host,
    sites: null,
    providers: []
  });

  return db.clear().then(function () {
    return bluebird.all([
      request(app).put('/components/valid', JSON.stringify(options.data)),
      request(app).get('/components/valid'),
      request(app).post('/components/valid', JSON.stringify(options.data)),
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
 * @param {Object} [options.pathsAndData] E.g. `{'path/one': data1, 'path/two': data2}`
 * @returns {Promise}
 */
function beforeEachTest(options) {
  app = express();
  host = options.hostname;
  stubSiteConfig(options.sandbox);
  stubFiles(options.sandbox);
  stubSchema(options.sandbox);
  stubGetTemplate(options.sandbox);
  stubMultiplexRender(options.sandbox);
  stubLogging(options.sandbox);
  stubUid(options.sandbox);
  routes.addHost({
    router: app,
    hostname: host
  });

  return db.clear().then(function () {
    if (options.pathsAndData) {
      return bluebird.all(_.map(options.pathsAndData, function (data, path) {

        if (typeof data === 'object') {
          data = JSON.stringify(data);
        }

        return db.put(host + path, data);
      }));
    }
  });
}

module.exports.setApp = setApp;
module.exports.setHost = setHost;
module.exports.acceptsHtml = acceptsHtml;
module.exports.acceptsHtmlBody = acceptsHtmlBody;
module.exports.acceptsJson = acceptsJson;
module.exports.acceptsJsonBody = acceptsJsonBody;
module.exports.acceptsText = acceptsText;
module.exports.acceptsTextBody = acceptsTextBody;
module.exports.updatesOther = updatesOther;
module.exports.createsNewVersion = createsNewVersion;
module.exports.cascades = cascades;
module.exports.expectDataPlusRef = expectDataPlusRef;
module.exports.beforeTesting = beforeTesting;
module.exports.beforeEachTest = beforeEachTest;
