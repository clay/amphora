'use strict';

const _ = require('lodash'),
  db = require('../../../lib/services/db'),
  endpointName = _.startCase(__dirname.split('/').pop()),
  express = require('express'),
  filename = _.startCase(__filename.split('/').pop().split('.').shift()),
  files = require('../../../lib/files'),
  hostname = 'some-hostname',
  winston = require('winston'),
  sinon = require('sinon'),
  routes = require('../../../lib/routes'),
  request = require('supertest-as-promised');

/**
 * @param {string} publicUri
 * @param {string} pageId
 * @returns {function}
 */
function addUri(publicUri, pageId) {
  return function () {
    return db.put(hostname + '/uris/' + new Buffer(publicUri).toString('base64'), hostname + '/pages/' + pageId);
  };
}

/**
 * @param {string} id
 * @param {object} data
 * @returns {function}
 */
function addPage(id, data) {
  return function () {
    return db.put(hostname + '/pages/' + id, JSON.stringify(data));
  };
}

describe(endpointName, function () {
  describe(filename, function () {
    var sandbox, app;

    beforeEach(function () {
      sandbox = sinon.sandbox.create();
      sandbox.stub(files, 'fileExists');
      sandbox.stub(winston);

      files.fileExists.withArgs('public').returns(true);

      app = express();
      routes.addHost(app, hostname);

      return db.clear()
        .then(addPage('a', {}))
        .then(addPage('b', {url: 'http://some-url/b'}))
        .then(addPage('c', {url: 'http://some-url/c'}))
        .then(addUri('some-url/c', 'c'))
        .then(addPage('d@published', {url: 'http://some-url/d'}))
        .then(addUri('some-url/d', 'd'))
        .then(addPage('e', {url: 'http://some-url/e'}))
        .then(addPage('e@published', {url: 'http://some-url/e'}))
        .then(addUri('some-url/e', 'e'));
    });

    afterEach(function () {
      sandbox.restore();
    });

    after(function () {
      return db.clear();
    });

    it('gets sitemap', function () {
      return request(app)
        .get('/sitemap.txt')
        .set('Host', hostname)
        .expect(200)
        .expect('Content-Type', /text/)
        .expect('http://some-url/d\nhttp://some-url/e\n');
    });

    it('gets sitemap even with bad json', function () {
      return db.put(hostname + '/pages/x@published', '{what?').then(function () {
        return request(app)
          .get('/sitemap.txt')
          .set('Host', hostname)
          .expect(200)
          .expect('Content-Type', /text/)
          .expect('http://some-url/d\nhttp://some-url/e\n')
          .then(function () {
            sinon.assert.calledWith(winston.log, 'warn');
          });
      });
    });
  });
});