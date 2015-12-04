'use strict';

var _ = require('lodash'),
  bluebird = require('bluebird'),
  db = require('./db'),
  expect = require('chai').expect,
  filename = __filename.split('/').pop().split('.').shift(),
  lib = require('./' + filename),
  log = require('../log'),
  rest = require('../rest'),
  sinon = require('sinon'),
  siteService = require('./sites'),
  uid = require('../uid');

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
    sandbox.stub(siteService, 'sites');
    sandbox.stub(log);
    sandbox.stub(uid);
    sandbox.stub(rest);
  });

  afterEach(function () {
    lib.stopListening();
    sandbox.restore();
  });

  describe('post', function () {
    var fn = lib[this.title];

    it('throws on missing "at" property', function (done) {
      var ref = 'domain/pages/some-name',
        data = {publish: 'http://abcg'};

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
        data = {at: 123, publish: 'http://abcf'};

      db.batch.returns(bluebird.resolve({}));

      expect(function () {
        fn(ref, data).nodeify(done);
      }).to.not.throw();
    });
  });

  describe('del', function () {
    var fn = lib[this.title];

    it('deletes a scheduled item', function (done) {
      var publishTarget = 'http://abcf',
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
      rest.getObject.returns(bluebird.resolve({}));
      rest.putObject.returns(bluebird.resolve({}));

      expect(function () {
        fn();
        fn();
      }).to.not.throw();
    });

    it('publishes', function (done) {
      var uri = 'http://abce',
        scheduledItem = {at: intervalDelay - 1, publish: uri},
        data = {key:'some-key', value: JSON.stringify(scheduledItem)};

      rest.getObject.returns(bluebird.resolve({}));
      rest.putObject.returns(bluebird.resolve({}));
      siteService.sites.returns([{host: 'a', path: '/'}]);
      db.pipeToPromise.returns(bluebird.resolve(JSON.stringify([data])));
      db.get.returns(bluebird.resolve(JSON.stringify(scheduledItem)));
      db.batch.returns(bluebird.resolve());

      fn();

      sandbox.clock.tick(intervalDelay);

      log.error = done;
      log.info = function () {
        done();
      };
    });

    it('logs error if missing thing to publish', function (done) {
      var uri = 'abce/pages/abcd',
        data = {key:'some-key', value: JSON.stringify({at: intervalDelay - 1, publish: uri})};

      rest.getObject.returns(bluebird.reject(new Error('guess it was not found')));
      siteService.sites.returns([{host: 'a', path: '/'}]);
      db.pipeToPromise.returns(bluebird.resolve(JSON.stringify([data])));

      fn();

      sandbox.clock.tick(intervalDelay);

      log.info = done;
      log.error = function (msg) {
        expect(msg).to.equal('failed to publish');
        done();
      };
    });

    it('logs error if failed to publish page', function (done) {
      bluebird.onPossiblyUnhandledRejection(_.noop);
      // rejection.suppressUnhandledRejections(); when bluebird supports it better

      var uri = 'http://abce',
        scheduledItem = {at: intervalDelay - 1, publish: uri},
        data = {key:'some-key', value: JSON.stringify(scheduledItem)};

      rest.getObject.returns(bluebird.resolve({}));
      rest.putObject.returns(bluebird.reject(new Error('')));
      siteService.sites.returns([{host: 'a', path: '/'}]);
      db.pipeToPromise.returns(bluebird.resolve(JSON.stringify([data])));
      db.get.returns(bluebird.resolve(JSON.stringify(scheduledItem)));
      db.batch.returns(bluebird.resolve());

      fn();

      sandbox.clock.tick(intervalDelay);

      log.info = done;
      log.error = function (msg) {
        expect(msg).to.equal('failed to publish');
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

      log.info = done;
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

      log.info = done;
      log.error = function () {
        done();
      };
    });
  });
});
