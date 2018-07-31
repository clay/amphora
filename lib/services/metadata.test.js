'use strict';

const _ = require('lodash'),
  filename = __filename.split('/').pop().split('.').shift(),
  lib = require('./' + filename),
  sinon = require('sinon'),
  bus = require('./bus'),
  expect = require('chai').expect,
  siteService = require('./sites'),
  storage = require('../../test/fixtures/mocks/storage');

describe(_.startCase(filename), function () {
  let sandbox, db;

  beforeEach(function () {
    sandbox = sinon.sandbox.create();

    sandbox.stub(siteService, 'getSiteFromPrefix');
    sandbox.stub(bus, 'publish');
    db = storage();
    lib.setDb(db);
  });

  afterEach(function () {
    sandbox.restore();
  });

  describe('getMeta', function () {
    const fn = lib[this.title];

    it('calls the db for the meta of a page/layout', function () {
      db.getMeta.returns(Promise.resolve());

      return fn('domain.com/_pages/id/meta')
        .then(() => {
          sinon.assert.calledWith(db.getMeta, 'domain.com/_pages/id');
        });
    });

    it('returns an empty object if there is a failure', function () {
      db.getMeta.returns(Promise.reject());

      return fn('domain.com/_pages/id/meta')
        .then(resp => {
          expect(resp).to.eql({});
          sinon.assert.calledWith(db.getMeta, 'domain.com/_pages/id');
        });
    });
  });

  describe('putMeta', function () {
    const fn = lib[this.title];

    it('puts to the db and pubs to the bus', function () {
      db.putMeta.returns(Promise.resolve());

      return fn('domain.com/_pages/id/meta', {})
        .then(() => {
          sinon.assert.calledWith(db.putMeta, 'domain.com/_pages/id', {});
          sinon.assert.calledOnce(bus.publish);
        });
    });
  });

  describe('patchMeta', function () {
    const fn = lib[this.title];

    it('puts to the db and pubs to the bus', function () {
      db.patchMeta.returns(Promise.resolve());
      db.getMeta.returns(Promise.resolve());

      return fn('domain.com/_pages/id/meta', {})
        .then(() => {
          sinon.assert.calledWith(db.patchMeta, 'domain.com/_pages/id', {});
          sinon.assert.calledWith(db.getMeta, 'domain.com/_pages/id');
          sinon.assert.calledOnce(bus.publish);
        });
    });
  });

  describe('createPage', function () {
    const fn = lib[this.title];

    it('creates page meta', function () {
      db.putMeta.returns(Promise.resolve());
      siteService.getSiteFromPrefix.returns({ slug: 'foo' });

      return fn('domain.com/_pages/id/meta', { username: 'foo', provider: 'bar' })
        .then(() => {
          sinon.assert.calledOnce(db.putMeta);
          sinon.assert.calledOnce(bus.publish);
        });
    });
  });

  describe('createLayout', function () {
    const fn = lib[this.title];

    it('creates layout meta', function () {
      db.putMeta.returns(Promise.resolve());
      siteService.getSiteFromPrefix.returns({ slug: 'foo' });

      return fn('domain.com/_pages/id/meta', { username: 'foo', provider: 'bar' })
        .then(() => {
          sinon.assert.calledOnce(db.putMeta);
          sinon.assert.calledOnce(bus.publish);
        });
    });
  });

  describe('publishPage', function () {
    const fn = lib[this.title];

    it('updates page meta', function () {
      db.getMeta.returns(Promise.resolve({ published: false }));
      db.putMeta.returns(Promise.resolve());

      return fn('domain.com/_pages/id/meta', {})
        .then(() => {
          sinon.assert.calledOnce(db.putMeta);
          sinon.assert.calledWith(db.getMeta, 'domain.com/_pages/id');
          sinon.assert.calledOnce(bus.publish);
        });
    });
  });

  describe('publishLayout', function () {
    const fn = lib[this.title];

    it('updates layout meta', function () {
      db.getMeta.returns(Promise.resolve({}));
      db.putMeta.returns(Promise.resolve());

      return fn('domain.com/_pages/id/meta', {})
        .then(() => {
          sinon.assert.calledOnce(db.putMeta);
          sinon.assert.calledWith(db.getMeta, 'domain.com/_pages/id');
          sinon.assert.calledOnce(bus.publish);
        });
    });
  });

  describe('unpublishPage', function () {
    const fn = lib[this.title];

    it('updates layout meta', function () {
      db.getMeta.returns(Promise.resolve({ published: false, history: [{}] }));
      db.putMeta.returns(Promise.resolve());

      return fn('domain.com/_pages/id/meta', {})
        .then(() => {
          sinon.assert.calledOnce(db.putMeta);
          sinon.assert.calledWith(db.getMeta, 'domain.com/_pages/id');
          sinon.assert.calledOnce(bus.publish);
        });
    });
  });
});
