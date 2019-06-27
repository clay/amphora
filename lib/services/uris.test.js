'use strict';

const _ = require('lodash'),
  bluebird = require('bluebird'),
  filename = __filename.split('/').pop().split('.').shift(),
  expect = require('chai').expect,
  sinon = require('sinon'),
  siteService = require('./sites'),
  notifications = require('./notifications'),
  meta = require('./metadata'),
  lib = require('./' + filename),
  storage = require('../../test/fixtures/mocks/storage');

describe(_.startCase(filename), function () {
  let sandbox, db;

  beforeEach(function () {
    sandbox = sinon.sandbox.create();
    sandbox.stub(notifications, 'notify');
    sandbox.stub(siteService, 'getSiteFromPrefix');
    sandbox.stub(meta);
    db = storage();
    lib.setDb(db);
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
      meta.unpublishPage.returns(Promise.resolve());

      return fn(uri).then(() => {
        sinon.assert.calledWith(notifications.notify, site, 'unpublished', eventData);
      });
    });

    it('does not notify if hooks is false', function () {
      const uri = 'something/_uris/bmljZXVybA==',
        oldData = 'some/page/ref';

      db.del.returns(bluebird.resolve());
      db.get.returns(bluebird.resolve(oldData));

      return fn(uri, {}, { hooks: 'false' }).then(() => {
        sinon.assert.notCalled(notifications.notify);
        sinon.assert.notCalled(meta.unpublishPage);
      });
    });

    it('deletes', function () {
      const uri = 'something/_uris/some-uri',
        site = {a: 'b'},
        oldData = {c: 'd'};

      db.del.returns(bluebird.resolve());
      db.get.returns(bluebird.resolve(oldData));
      siteService.getSiteFromPrefix.returns(site);
      meta.unpublishPage.returns(Promise.resolve());

      return fn(uri).then(() => {
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
      meta.unpublishPage.returns(Promise.resolve());

      return fn(uri).then(function (result) {
        expect(result).to.deep.equal(oldData);
      });
    });
  });
});
