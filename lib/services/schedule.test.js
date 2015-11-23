'use strict';

var _ = require('lodash'),
  filename = __filename.split('/').pop().split('.').shift(),
  lib = require('./' + filename),
  components = require('./components'),
  expect = require('chai').expect,
  sinon = require('sinon'),
  bluebird = require('bluebird'),
  db = require('./db'),
  log = require('../log'),
  pages = require('./pages'),
  siteService = require('./sites');

describe(_.startCase(filename), function () {
  var sandbox,
    intervalDelay = 100;

  beforeEach(function () {
    sandbox = sinon.sandbox.create();
    sandbox.useFakeTimers();
    lib.setScheduleInterval(intervalDelay);
    sandbox.stub(db, 'get');
    sandbox.stub(db, 'put');
    sandbox.stub(db, 'batch');
    sandbox.stub(db, 'pipeToPromise');
    sandbox.stub(pages, 'publish');
    sandbox.stub(components, 'get');
    sandbox.stub(components, 'put');
    sandbox.stub(siteService, 'sites');
    sandbox.stub(log, 'info');
    sandbox.stub(log, 'warn');
    sandbox.stub(log, 'error');
  });

  afterEach(function () {
    lib.stopListening();
    sandbox.restore();
  });

  describe('post', function () {
    var fn = lib[this.title];

    it('throws on missing "at" property', function (done) {
      var ref = 'domain/pages/some-name',
        data = {publish: 'abcg'};

      expect(function () {
        fn(ref, data).nodeify(done);
      }).to.throw();

      done();
    });

    it('throws on missing "publish" property', function (done) {
      var ref = 'domain/pages/some-name',
        data = {at: 123};

      expect(function () {
        fn(ref, data).nodeify(done);
      }).to.throw();

      done();
    });

    it('schedules a publish of abc at 123', function (done) {
      var ref = 'domain/pages/some-name',
        data = {at: 123, publish: 'abcf'};

      db.batch.returns(bluebird.resolve({}));

      expect(function () {
        fn(ref, data).nodeify(done);
      }).to.not.throw();
    });
  });

  describe('del', function () {
    var fn = lib[this.title];

    it('deletes a scheduled item', function (done) {
      var publishTarget = 'abcf',
        publishDate = 123,
        ref = 'domain/pages/some-name',
        data = {at: 123, publish: publishTarget};

      db.get.returns(bluebird.resolve(JSON.stringify({at: publishDate, publish: publishTarget})));
      db.batch.returns(bluebird.resolve());

      expect(function () {
        fn(ref, data).nodeify(done);
      }).to.not.throw();
    });
  });

  describe('startListening', function () {
    var fn = lib[this.title];

    it('does not throw if started twice', function () {
      expect(function () {
        fn();
        fn();
      }).to.not.throw();
    });

    it('publishes page', function (done) {
      var uri = 'abce/pages/abce',
        scheduledItem = {at: intervalDelay - 1, publish: uri},
        data = {key:'some-key', value: JSON.stringify(scheduledItem)};

      siteService.sites.returns([{host: 'a', path: '/'}]);
      db.pipeToPromise.returns(bluebird.resolve(JSON.stringify([data])));
      pages.publish.returns(bluebird.resolve());
      db.get.returns(bluebird.resolve(JSON.stringify(scheduledItem)));
      db.batch.returns(bluebird.resolve());

      fn();

      sandbox.clock.tick(intervalDelay);

      log.info = function () {
        sinon.assert.calledWith(pages.publish, uri);
        done();
      };
    });


    it('publishes component', function (done) {
      var uri = 'abce/components/abce',
        scheduledItem = {at: intervalDelay - 1, publish: uri},
        data = {key:'some-key', value: JSON.stringify(scheduledItem)},
        componentData = {someData: 'someValue'};

      siteService.sites.returns([{host: 'a', path: '/'}]);
      db.pipeToPromise.returns(bluebird.resolve(JSON.stringify([data])));
      components.get.returns(bluebird.resolve(componentData));
      components.put.returns(bluebird.resolve(componentData));
      db.get.returns(bluebird.resolve(JSON.stringify(scheduledItem)));
      db.batch.returns(bluebird.resolve());

      fn();

      sandbox.clock.tick(intervalDelay);

      log.info = function () {
        sinon.assert.calledWith(components.put, uri + '@published', componentData);
        done();
      };
    });

    it('logs error if failed to publish page', function (done) {
      bluebird.onPossiblyUnhandledRejection(function () {});
      // rejection.suppressUnhandledRejections(); when bluebird supports it better

      var uri = 'abce/pages/abcd',
        data = {key:'some-key', value: JSON.stringify({at: intervalDelay - 1, publish: uri})};

      siteService.sites.returns([{host: 'a', path: '/'}]);
      db.pipeToPromise.returns(bluebird.resolve(JSON.stringify([data])));
      pages.publish.returns(bluebird.reject(new Error('')));

      fn();

      sandbox.clock.tick(intervalDelay);

      log.error = function () {
        sinon.assert.calledWith(pages.publish, uri);
        done();
      };
    });

    it('logs error if failed to parse JSON', function (done) {
      var uri = 'abce/pages/abcd',
        data = {key:'some-key', value: JSON.stringify({at: intervalDelay - 1, publish: uri}).substring(5)};

      siteService.sites.returns([{host: 'a', path: '/'}]);
      db.pipeToPromise.returns(bluebird.resolve(JSON.stringify([data])));

      fn();

      sandbox.clock.tick(intervalDelay);

      log.error = function () {
        done();
      };
    });

    it('logs error if missing publish attribute', function (done) {
      var data = {key:'some-key', value: JSON.stringify({at: intervalDelay - 1})};

      siteService.sites.returns([{host: 'a', path: '/'}]);
      db.pipeToPromise.returns(bluebird.resolve(JSON.stringify([data])));

      fn();

      sandbox.clock.tick(intervalDelay);

      log.error = function () {
        done();
      };
    });

    it('logs error if missing publish attribute', function (done) {
      var uri = 'abce/unknown/abcd',
        data = {key:'some-key', value: JSON.stringify({at: intervalDelay - 1, publish: uri})};

      siteService.sites.returns([{host: 'a', path: '/'}]);
      db.pipeToPromise.returns(bluebird.resolve(JSON.stringify([data])));

      fn();

      sandbox.clock.tick(intervalDelay);

      log.error = function () {
        done();
      };
    });
  });
});
