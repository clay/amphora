'use strict';
var _ = require('lodash'),
  filename = __filename.split('/').pop().split('.').shift(),
  references = require('./' + filename),
  expect = require('chai').expect,
  sinon = require('sinon'),
  files = require('./files'),
  db = require('./db'),
  schema = require('./schema'),
  config = require('config'),
  glob = require('glob'),
  bluebird = require('bluebird');

describe(_.startCase(filename), function () {
  var sandbox;

  beforeEach(function () {
    sandbox = sinon.sandbox.create();
  });

  afterEach(function () {
    sandbox.restore();
  });

  describe('getPageData', function () {
    it('basic case', function (done) {
      var data = {},
        ref = '/pages/whatever';
      sandbox.mock(db).expects('get').withArgs(ref).returns(bluebird.resolve(JSON.stringify(data)));

      references.getPageData(ref).done(function (result) {
        sandbox.verify();
        expect(result).to.deep.equal(data);
        done();
      }, function (err) {
        done(err);
      });
    });
  });

  describe('putPageData', function () {
    it('basic case', function (done) {
      var data = {},
        ref = '/pages/whatever';
      sandbox.mock(db).expects('put').withArgs(ref, JSON.stringify(data)).returns(bluebird.resolve(data));

      references.putPageData(ref, data).done(function (result) {
        sandbox.verify();
        expect(result).to.equal(data);
        done();
      }, function (err) {
        done(err);
      });
    });
  });

  describe('getUriData', function () {
    it('basic case', function (done) {
      var data = 'thing',
        ref = '/uris/whatever';
      sandbox.mock(db).expects('get').withArgs(ref).returns(bluebird.resolve(data));

      references.getUriData(ref).done(function (result) {
        sandbox.verify();
        expect(result).to.equal(data);
        done();
      }, function (err) {
        done(err);
      });
    });
  });

  describe('putUriData', function () {
    it('basic case', function (done) {
      var data = 'thing',
        ref = '/uris/whatever';
      sandbox.mock(db).expects('put', data).withArgs(ref).returns(bluebird.resolve());

      references.putUriData(ref, data).done(function () {
        done();
      }, function (err) {
        done(err);
      });
    });
  });
});