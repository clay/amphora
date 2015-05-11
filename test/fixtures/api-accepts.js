'use strict';

var _ = require('lodash'),
  express = require('express'),
  request = require('supertest-as-promised'),
  files = require('../../services/files'),
  routes = require('../../services/routes'),
  db = require('../../services/db'),
  bluebird = require('bluebird'),
  app,
  host;

function createTest(options) {
  var realPath = _.reduce(options.replacements, function (str, value, key) { return str.replace(':' + key, value); }, options.path);

  it(options.description, function () {
    var promise = request(app)[options.method](realPath)
      .set('Host', host)
      .set('Accept', options.accept);

    if (options.body) {
      if (_.isObject(options.body)) {
        options.body = JSON.stringify(options.body);
      }

      promise = promise.send(options.body);
    }

    promise = promise.expect('Content-Type', options.contentType)
      .expect(options.status);

    if (options.data) {
      console.log(options.description, 'data', options.data);
      promise = promise.expect(options.data);
    }

    return promise;
  });
}

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

function setApp(value) {
  app = value;
}

function setHost(value) {
  host = value;
}

function stubComponentPath(sandbox) {
  var getComponentPath = sandbox.stub(files, 'getComponentPath');
  getComponentPath.withArgs('valid').returns('validThing');
  getComponentPath.withArgs('missing').returns('missingThing');
  getComponentPath.withArgs('invalid').returns(null);
  return sandbox;
}

function beforeEach(sandbox, hostname, data) {
  app = express();
  host = hostname;
  stubComponentPath(sandbox);
  routes.addHost(app, hostname);

  return db.clear().then(function () {
    return bluebird.all([
      db.put('/components/valid', JSON.stringify(data)),
      db.put('/components/valid/instances/valid', JSON.stringify(data))
    ]);
  });
}


module.exports.setApp = setApp;
module.exports.setHost = setHost;
module.exports.acceptsHtml = acceptsHtml;
module.exports.acceptsJson = acceptsJson;
module.exports.acceptsJsonBody = acceptsJsonBody;
module.exports.stubComponentPath = stubComponentPath;
module.exports.beforeEach = beforeEach;