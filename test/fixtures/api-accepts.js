'use strict';

var _ = require('lodash'),
  express = require('express'),
  request = require('supertest-as-promised'),
  files = require('../../services/files'),
  routes = require('../../services/routes'),
  db = require('../../services/db'),
  bluebird = require('bluebird'),
  expect = require('chai').expect,
  app,
  host;

function acceptsHtml(method) {
  return function (path, replacements, status) {
    var realPath = _.reduce(replacements, function (str, value, key) { return str.replace(':' + key, value); }, path);

    it(JSON.stringify(replacements) + ' accepts html', function () {
      return request(app)[method](realPath)
        .set('Host', host)
        .set('Accept', 'text/html')
        .expect('Content-Type', /html/)
        .expect(status);
    });
  };
}

function acceptsJson(method) {
  return function (path, replacements, status, data) {
    var realRath = _.reduce(replacements, function (str, value, key) { return str.replace(':' + key, value); }, path);

    it(JSON.stringify(replacements) + ' accepts json', function () {
      var promise = request(app)[method](realRath)
        .set('Host', host)
        .set('Accept', 'application/json')
        .expect('Content-Type', /json/)
        .expect(status);

      if (data) {
        promise.expect(data);
      }

      return promise;
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

  return bluebird.all([
    db.put('/components/valid', JSON.stringify(data)),
    db.put('/components/valid/instances/valid', JSON.stringify(data))
  ]);
}


module.exports.setApp = setApp;
module.exports.setHost = setHost;
module.exports.acceptsHtml = acceptsHtml;
module.exports.acceptsJson = acceptsJson;
module.exports.stubComponentPath = stubComponentPath;
module.exports.beforeEach = beforeEach;