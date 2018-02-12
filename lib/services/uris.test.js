'use strict';
const _ = require('lodash'),
  bluebird = require('bluebird'),
  db = require('./db'),
  filename = __filename.split('/').pop().split('.').shift(),
  expect = require('chai').expect,
  sinon = require('sinon'),
  siteService = require('./sites'),
  notifications = require('./notifications'),
  plugins = require('../plugins'),
  lib = require('./' + filename);

describe(_.startCase(filename), function () {
  let sandbox;

  beforeEach(function () {
    sandbox = sinon.sandbox.create();
    sandbox.stub(db, 'get');
    sandbox.stub(db, 'del');
    sandbox.stub(notifications, 'notify');
    sandbox.stub(plugins, 'executeHook');
    sandbox.stub(siteService, 'getSiteFromPrefix');
  });

  afterEach(function () {
    sandbox.restore();
  });

  describe('del', function () {
    const fn = lib[this.title];

    it('notifies', function () {
      const uri = 'something/_uris/bmljZXVybA==',
        site = {a: 'b'},
        oldData = 'some/page/ref',
        oldUrl = 'niceurl',
        eventData = { uri: oldData, url: oldUrl };

      db.del.returns(bluebird.resolve());
      db.get.returns(bluebird.resolve(oldData));
      siteService.getSiteFromPrefix.returns(site);

      return fn(uri).then(function () {
        sinon.assert.calledWith(notifications.notify, site, 'unpublished', eventData);
      });
    });

    it('plugin unpublish hook', function () {
      const uri = 'something/_uris/bmljZXVybA==',
        site = {a: 'b'},
        oldData = {url: 'niceurl'};

      db.del.returns(bluebird.resolve());
      db.get.returns(bluebird.resolve(oldData));
      siteService.getSiteFromPrefix.returns(site);

      return fn(uri).then(function () {
        sinon.assert.calledWith(plugins.executeHook, 'unpublish');
      });
    });

    it('deletes', function () {
      const uri = 'something/_uris/some-uri',
        site = {a: 'b'},
        oldData = {c: 'd'};

      db.del.returns(bluebird.resolve());
      db.get.returns(bluebird.resolve(oldData));
      siteService.getSiteFromPrefix.returns(site);

      return fn(uri).then(function () {
        sinon.assert.calledWith(db.del, uri);
      });
    });

    it('returns old data', function () {
      const uri = 'something/_uris/some-uri',
        site = {a: 'b'},
        oldData = {c: 'd'};

      db.del.returns(bluebird.resolve());
      db.get.returns(bluebird.resolve(oldData));
      siteService.getSiteFromPrefix.returns(site);

      return fn(uri).then(function (result) {
        expect(result).to.deep.equal(oldData);
      });
    });
  });
});
