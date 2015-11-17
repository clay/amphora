'use strict';

var _ = require('lodash'),
  filename = __filename.split('/').pop().split('.').shift(),
  lib = require('./' + filename),
  expect = require('chai').expect,
  sinon = require('sinon'),
  bluebird = require('bluebird'),
  db = require('../services/db'),
  log = require('../log'),
  pages = require('../services/pages'),
  siteService = require('../services/sites');

describe(_.startCase(filename), function () {
  var sandbox;

  beforeEach(function () {
    sandbox = sinon.sandbox.create();
    sandbox.useFakeTimers();
    sandbox.stub(db, 'get');
    sandbox.stub(db, 'put');
    sandbox.stub(db, 'pipeToPromise');
    sandbox.stub(pages, 'publish');
    sandbox.stub(siteService, 'sites');
    sandbox.stub(log, 'info');
    sandbox.stub(log, 'error');
  });

  afterEach(function () {
    lib.stopListening();
    sandbox.restore();
  });

  describe('create', function () {
    var fn = lib[this.title];

    it('throws on missing "at" property', function () {
      var ref = 'domain/pages/some-name',
        data = {publish: 'abc'};

      expect(function () {
        fn(ref, data);
      }).to.throw();
    });

    it('throws on missing "publish" property', function () {
      var ref = 'domain/pages/some-name',
        data = {at: 123};

      expect(function () {
        fn(ref, data);
      }).to.throw();
    });

    it('schedules a publish of abc at 123', function () {
      var ref = 'domain/pages/some-name',
        data = {at: 123, publish: 'abc'};

      db.put.returns(bluebird.resolve({}));

      expect(function () {
        fn(ref, data);
      }).to.not.throw();
    });
  });

  describe('startListening', function () {
    var fn = lib[this.title];

    it('publishes abc at 123', function (done) {
      var data = {at: 123, publish: 'abc'};

      siteService.sites.returns([{host: 'a', path: '/'}]);
      db.pipeToPromise.returns(bluebird.resolve([data]));
      pages.publish.returns(bluebird.resolve());

      fn();

      sandbox.clock.tick(60000);

      _.defer(function () {
        sinon.assert.calledWith(pages.publish, 'abc');
        sinon.assert.calledWith(log.info, 'published', data.publish, 'at', data.at);
        done();
      });
    });

    it('logs error if failed to publish', function (done) {
      var data = {at: 123, publish: 'abc'};

      siteService.sites.returns([{host: 'a', path: '/'}]);
      db.pipeToPromise.returns(bluebird.resolve([data]));
      pages.publish.returns(bluebird.reject(new Error('')));

      fn();

      sandbox.clock.tick(60000);

      _.defer(function () {
        sinon.assert.calledWith(pages.publish, 'abc');
        sinon.assert.calledOnce(log.error);
        done();
      });
    });
  });
});
