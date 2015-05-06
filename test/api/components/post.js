'use strict';

var app,
  _ = require('lodash'),
  express = require('express'),
  endpointName = _.startCase(__dirname.split('/').pop()),
  filename = _.startCase(__filename.split('/').pop().split('.').shift()),
  request = require('supertest-as-promised'),
  sinon = require('sinon'),
  routes = require('../../../services/routes'),
  files = require('../../../services/files'),
  db = require('../../../services/db'),
  bluebird = require('bluebird'),
  hostname = 'localhost.vulture.com';

/**
 * @param path
 * @param replacements
 * @param status
 * @param [data]
 */
function acceptsJson(path, replacements, status, data) {
  path = _.reduce(replacements, function (str, value, key) { return str.replace(':' + key, value); }, path);

  it(JSON.stringify(replacements) + ' accepts json', function () {
    var promise = request(app)
      .post(path)
      .set('Host', hostname)
      .set('Accept', 'application/json')
      .expect('Content-Type', /json/)
      .expect(status);

    if (data) {
      promise.expect(data);
    }

    return promise;
  });
}

/**
 * @param path
 * @param replacements
 * @param status
 */
function acceptsHtml(path, replacements, status) {
  path = _.reduce(replacements, function (str, value, key) { return str.replace(':' + key, value); }, path);

  it(JSON.stringify(replacements) + ' accepts html', function () {
    return request(app)
      .post(path)
      .set('Host', hostname)
      .set('Accept', 'text/html')
      .expect('Content-Type', /html/)
      .expect(status);
  });
}

describe(endpointName, function () {
  var sandbox,
    data = { name: 'Manny', species: 'cat' };

  before(function () {
    return bluebird.all([
      db.put('/components/valid', JSON.stringify(data)),
      db.put('/components/valid/instances/valid', JSON.stringify(data))
    ]);
  });

  beforeEach(function () {
    sandbox = sinon.sandbox.create();
  });

  afterEach(function () {
    sandbox.restore();
  });

  describe(filename, function () {
    var getComponentPath;
    beforeEach(function () {
      getComponentPath = sandbox.stub(files, 'getComponentPath');
      getComponentPath.withArgs('valid').returns('validThing');
      getComponentPath.withArgs('missing').returns('missingThing');
      getComponentPath.withArgs('invalid').returns(null);

      app = express();
      routes.addHost(app, hostname);
    });

    describe('/components', function () {
      var path = this.title;
      acceptsJson(path, {}, 405);
      acceptsHtml(path, {}, 405);
    });

    describe('/components/:name', function () {
      var path = this.title;

      acceptsJson(path, {name: 'invalid'}, 404);
      acceptsJson(path, {name: 'valid'}, 405);
      acceptsJson(path, {name: 'missing'}, 405);

      acceptsHtml(path, {name: 'invalid'}, 404);
      acceptsHtml(path, {name: 'valid'}, 406);
      acceptsHtml(path, {name: 'missing'}, 406);
    });

    describe('/components/:name/instances', function () {
      var path = this.title;

      acceptsJson(path, {name: 'invalid'}, 404);
      acceptsJson(path, {name: 'valid'}, 405);
      acceptsJson(path, {name: 'missing'}, 405);

      acceptsHtml(path, {name: 'invalid'}, 404);
      acceptsHtml(path, {name: 'valid'}, 406);
      acceptsHtml(path, {name: 'missing'}, 406);
    });

    describe('/components/:name/instances/:id', function () {
      var path = this.title;

      acceptsJson(path, {name: 'invalid', id: 'valid'}, 404);
      acceptsJson(path, {name: 'valid', id: 'valid'}, 405);
      acceptsJson(path, {name: 'valid', id: 'missing'}, 405);

      acceptsHtml(path, {name: 'invalid', id: 'valid'}, 404);
      acceptsHtml(path, {name: 'valid', id: 'valid'}, 406);
      acceptsHtml(path, {name: 'valid', id: 'missing'}, 406);
    });
  });
});