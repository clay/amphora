'use strict';

const _ = require('lodash'),
  bluebird = require('bluebird'),
  db = require('./db'),
  expect = require('chai').expect,
  filename = __filename.split('/').pop().split('.').shift(),
  lib = require('./' + filename),
  winston = require('winston'),
  rest = require('../rest'),
  sinon = require('sinon'),
  siteService = require('./sites'),
  uid = require('../uid');

describe(_.startCase(filename), function () {
  let sandbox,
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
    sandbox.stub(winston);
    sandbox.stub(uid);
    sandbox.stub(rest);
  });

  afterEach(function () {
    lib.stopListening();
    sandbox.restore();
  });

  describe('post', function () {
    const fn = lib[this.title];

    it('throws on missing "at" property', function (done) {
      const ref = 'domain/pages/some-name',
        data = {publish: 'http://abcg'};

      expect(function () {
        fn(ref, data).nodeify(done);
      }).to.throw();

      done();
    });

    it('throws on missing "publish" property', function (done) {
      const ref = 'domain/pages/some-name',
        data = {at: 123};

      expect(function () {
        fn(ref, data).nodeify(done);
      }).to.throw();

      done();
    });

    it('schedules a publish of abc at 123', function () {
      const ref = 'domain/schedule',
        data = {at: 123, publish: 'http://abc/pages/def'};

      uid.get.returns('some-random-id');
      db.batch.returns(bluebird.resolve({}));

      return fn(ref, data).then(function () {
        sinon.assert.calledWith(db.batch, [{
          key: 'domain/schedule/some-random-id',
          type: 'put',
          value: '{"at":123,"publish":"http://abc/pages/def"}'
        }, {
          key: 'abc/pages/def@scheduled',
          type: 'put',
          value: '{"_ref":"domain/schedule/some-random-id","at":123,"publish":"http://abc/pages/def"}'
        }]);
      });
    });
  });

  describe('del', function () {
    const fn = lib[this.title];

    it('deletes a scheduled item', function () {
      const publishTarget = 'http://abc/pages/def',
        publishDate = 123,
        ref = 'domain/schedule/some-specific-id',
        data = {at: 123, publish: publishTarget};

      uid.get.returns('some-random-id');
      db.get.returns(bluebird.resolve(JSON.stringify({at: publishDate, publish: publishTarget})));
      db.batch.returns(bluebird.resolve());

      return fn(ref, data).then(function () {
        sinon.assert.calledWith(db.batch, [
          { key: ref, type: 'del' },
          { key: 'abc/pages/def@scheduled', type: 'del' }
        ]);
      });
    });
  });

  describe('startListening', function () {
    const fn = lib[this.title];

    it('does not throw if started twice', function () {
      rest.getObject.returns(bluebird.resolve({}));
      rest.putObject.returns(bluebird.resolve({}));

      expect(function () {
        fn();
        fn();
      }).to.not.throw();
    });

    it('publishes', function (done) {
      const uri = 'http://abce',
        scheduledItem = {at: intervalDelay - 1, publish: uri},
        data = {key:'some-key', value: JSON.stringify(scheduledItem)};

      rest.putObject.returns(bluebird.resolve({}));
      siteService.sites.returns([{host: 'a', path: '/'}]);
      db.pipeToPromise.returns(bluebird.resolve(JSON.stringify([data])));
      db.get.returns(bluebird.resolve(JSON.stringify(scheduledItem)));
      db.batch.returns(bluebird.resolve());

      fn();

      sandbox.clock.tick(intervalDelay);

      winston.log = function (logType) {
        expect(logType).to.equal('info');
        done();
      };
    });

    it('logs error if failed to publish page', function (done) {
      bluebird.onPossiblyUnhandledRejection(_.noop);
      // rejection.suppressUnhandledRejections(); when bluebird supports it better

      const uri = 'http://abce',
        scheduledItem = {at: intervalDelay - 1, publish: uri},
        data = {key:'some-key', value: JSON.stringify(scheduledItem)};

      rest.putObject.returns(bluebird.reject(new Error('')));
      siteService.sites.returns([{host: 'a', path: '/'}]);
      db.pipeToPromise.returns(bluebird.resolve(JSON.stringify([data])));
      db.get.returns(bluebird.resolve(JSON.stringify(scheduledItem)));
      db.batch.returns(bluebird.resolve());

      fn();

      sandbox.clock.tick(intervalDelay);

      winston.log = function (logType, msg) {
        expect(logType).to.equal('error');
        expect(msg).to.match(/failed to publish/);
        done();
      };
    });

    it('logs error if failed to parse JSON', function (done) {
      const uri = 'abce/pages/abcd',
        data = {key:'some-key', value: JSON.stringify({at: intervalDelay - 1, publish: uri}).substring(5)};

      siteService.sites.returns([{host: 'a', path: '/'}]);
      db.pipeToPromise.returns(bluebird.resolve(JSON.stringify([data])));

      fn();

      sandbox.clock.tick(intervalDelay);

      winston.log = function (logType, msg) {
        expect(logType).to.equal('error');
        expect(msg).to.match(/failed to publish/);
        done();
      };
    });

    it('logs error if missing publish attribute', function (done) {
      const uri = 'abce/unknown/abcd',
        data = {key:'some-key', value: JSON.stringify({at: intervalDelay - 1, publish: uri})};

      siteService.sites.returns([{host: 'a', path: '/'}]);
      db.pipeToPromise.returns(bluebird.resolve(JSON.stringify([data])));

      fn();

      sandbox.clock.tick(intervalDelay);

      winston.log = function (logType, msg) {
        expect(logType).to.equal('error');
        expect(msg).to.match(/failed to publish/);
        done();
      };
    });
  });
});
