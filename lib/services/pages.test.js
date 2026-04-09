'use strict';

const _ = require('lodash'),
  bluebird = require('bluebird'),
  components = require('./components'),
  layouts = require('./layouts'),
  expect = require('chai').expect,
  filename = __filename.split('/').pop().split('.').shift(),
  lib = require('./' + filename),
  notifications = require('./notifications'),
  sinon = require('sinon'),
  siteService = require('./sites'),
  timer = require('../timer'),
  meta = require('./metadata'),
  schema = require('../utils/schema'),
  publishService = require('./publish'),
  composer = require('./composer'),
  bus = require('./bus'),
  dbOps = require('./db-operations'),
  storage = require('../../test/fixtures/mocks/storage');

describe(_.startCase(filename), function () {
  const timeoutConstant = 100;
  let sandbox, db,
    savedTimeoutConstant,
    fakeLog;

  beforeEach(function () {
    sandbox = sinon.sandbox.create();
    fakeLog = sandbox.stub();
    sandbox.stub(components, 'get');
    sandbox.stub(layouts, 'get');
    sandbox.stub(siteService, 'getSiteFromPrefix');
    sandbox.stub(notifications, 'notify');
    sandbox.stub(dbOps);
    sandbox.stub(timer);
    sandbox.stub(meta);
    sandbox.stub(bus);
    sandbox.stub(schema, 'getSchema');
    sandbox.stub(composer);
    sandbox.stub(publishService, 'resolvePublishUrl');
    db = storage();
    lib.setDb(db);

    savedTimeoutConstant = lib.getTimeoutConstant();
    lib.setTimeoutConstant(timeoutConstant);
    lib.setLog(fakeLog);
  });

  afterEach(function () {
    sandbox.restore();

    lib.setTimeoutConstant(savedTimeoutConstant);
  });

  describe('create', function () {
    const fn = lib[this.title];

    it('errors if no layout is in the data', function () {
      const result = () => fn('domain.com/path/_pages', {layout: 'domain.com/path/_components/thing'});

      expect(result).to.throw(Error);
    });

    it('creates without content', function () {
      layouts.get.returns(Promise.resolve({}));
      db.batch.returns(Promise.resolve());
      siteService.getSiteFromPrefix.returns({notify: _.noop});
      meta.createPage.returns(Promise.resolve());

      return fn('domain.com/path/_pages', {layout: 'domain.com/path/_layouts/thing'})
        .then(result => {
          expect(result._ref).to.match(/^domain.com\/path\/_pages\//);
          delete result._ref;
          expect(result).to.deep.equal({layout: 'domain.com/path/_layouts/thing'});
        });
    });

    it('creates with content', function () {
      const uri = 'domain.com/path/_pages',
        contentUri = 'domain.com/path/_components/thing1/instances/foo',
        layoutUri = 'domain.com/path/_layouts/thing2',
        data = { layout: layoutUri, content: [contentUri] },
        contentData = {},
        layoutReferenceData = {};

      layouts.get.withArgs(layoutUri).returns(Promise.resolve(layoutReferenceData));
      components.get.withArgs(contentUri).returns(Promise.resolve(contentData));
      composer.resolveComponentReferences.returns(Promise.resolve({
        content: [{
          _ref: contentUri,
          foo: true
        }]
      }));
      schema.getSchema.withArgs(contentUri).returns(Promise.resolve({}));
      db.batch.returns(Promise.resolve());
      siteService.getSiteFromPrefix.returns({notify: _.noop});
      meta.createPage.returns(Promise.resolve());

      return fn(uri, data).then(function (result) {
        // self reference is returned, but in a new instance with a new name
        expect(result._ref).to.match(/^domain\.com\/path\/_pages\//);

        // layout will be the same
        expect(result.layout).to.equal(layoutUri);

        // new data will be put into a new instance
        expect(result.content).to.match(/^domain\.com\/path\/_components\/thing1\/instances\//);
      });
    });

    it('normalizes cloned content using schema clone directives', function () {
      const uri = 'domain.com/path/_pages',
        contentUri = 'domain.com/path/_components/thing1/instances/foo',
        layoutUri = 'domain.com/path/_layouts/thing2',
        data = { layout: layoutUri, content: [contentUri] },
        contentData = {},
        layoutReferenceData = {},
        normalizedRefPattern = /^domain\.com\/path\/_components\/thing1\/instances\//;

      layouts.get.withArgs(layoutUri).returns(Promise.resolve(layoutReferenceData));
      components.get.withArgs(contentUri).returns(Promise.resolve(contentData));
      composer.resolveComponentReferences.returns(Promise.resolve({
        publishDate: '2020-01-01T00:00:00.000Z',
        firstPublishedAt: '2020-01-02T00:00:00.000Z',
        status: 'published',
        content: [{
          _ref: contentUri,
          foo: true
        }]
      }));
      schema.getSchema.withArgs(contentUri).returns(Promise.resolve({
        _resetOnPageClone: {
          status: 'draft',
          publishDate: null
        },
        _omitOnPageClone: ['firstPublishedAt']
      }));
      db.batch.returns(Promise.resolve());
      siteService.getSiteFromPrefix.returns({notify: _.noop});
      meta.createPage.returns(Promise.resolve());

      return fn(uri, data).then(function () {
        const args = dbOps.getPutOperations.getCall(0).args;

        expect(args[0]).to.equal(components.cmptPut);
        expect(args[1]).to.match(normalizedRefPattern);
        expect(args[2]).to.deep.equal({
          publishDate: null,
          status: 'draft',
          content: [{
            _ref: args[2].content[0]._ref,
            foo: true
          }]
        });
        expect(args[2].content[0]._ref).to.match(normalizedRefPattern);
      });
    });

    it('warns when schema clone directives reset and omit the same field', function () {
      const uri = 'domain.com/path/_pages',
        contentUri = 'domain.com/path/_components/thing1/instances/foo',
        layoutUri = 'domain.com/path/_layouts/thing2',
        data = { layout: layoutUri, content: [contentUri] },
        contentData = {},
        layoutReferenceData = {};

      layouts.get.withArgs(layoutUri).returns(Promise.resolve(layoutReferenceData));
      components.get.withArgs(contentUri).returns(Promise.resolve(contentData));
      composer.resolveComponentReferences.returns(Promise.resolve({
        publishDate: '2020-01-01T00:00:00.000Z'
      }));
      schema.getSchema.withArgs(contentUri).returns(Promise.resolve({
        _resetOnPageClone: {
          publishDate: null
        },
        _omitOnPageClone: ['publishDate']
      }));
      db.batch.returns(Promise.resolve());
      siteService.getSiteFromPrefix.returns({notify: _.noop});
      meta.createPage.returns(Promise.resolve());

      return fn(uri, data).then(function () {
        sinon.assert.calledWith(fakeLog, 'warn', sinon.match("_resetOnPageClone and _omitOnPageClone for the same field(s): publishDate"));
        expect(dbOps.getPutOperations.getCall(0).args[2]).to.deep.equal({});
      });
    });

    it('skips clone normalization when schema lookup fails', function () {
      const uri = 'domain.com/path/_pages',
        contentUri = 'domain.com/path/_components/thing1/instances/foo',
        layoutUri = 'domain.com/path/_layouts/thing2',
        data = { layout: layoutUri, content: [contentUri] },
        contentData = {},
        layoutReferenceData = {},
        resolvedData = {
          publishDate: '2020-01-01T00:00:00.000Z'
        };

      layouts.get.withArgs(layoutUri).returns(Promise.resolve(layoutReferenceData));
      components.get.withArgs(contentUri).returns(Promise.resolve(contentData));
      composer.resolveComponentReferences.returns(Promise.resolve(resolvedData));
      schema.getSchema.withArgs(contentUri).returns(Promise.reject(new Error('Schema not found!')));
      db.batch.returns(Promise.resolve());
      siteService.getSiteFromPrefix.returns({notify: _.noop});
      meta.createPage.returns(Promise.resolve());

      return fn(uri, data).then(function () {
        sinon.assert.calledWith(dbOps.getPutOperations, components.cmptPut, sinon.match.string, resolvedData);
      });
    });
  });

  describe('publish', function () {
    const fn = lib[this.title],
      locals = {
        site: {
          resolvePublishUrl: []
        }
      };

    it('creates relevant uri', function () {
      var pageData = {
        layout: 'domain.com/path/_layouts/thing',
        main: [ 'domain.com/path/_components/foo' ]
      };

      layouts.get.returns(Promise.resolve({}));
      components.get.returns(Promise.resolve());
      db.getLatestData.returns(Promise.resolve());
      db.batch.returns(Promise.resolve());
      notifications.notify.returns(Promise.resolve());
      publishService.resolvePublishUrl.returns(() => Promise.resolve({
        meta: { url: 'http://some-domain.com/' },
        data: pageData
      }));
      meta.publishPage.returns(Promise.resolve());

      return fn('domain.com/path/_pages/thing@published', pageData, locals)
        .then(() => {
          const ops = db.batch.args[0][0],
            secondLastOp = ops[ops.length - 2];

          expect(secondLastOp).to.deep.equal({
            type: 'put',
            key: 'domain.com/path/_uris/c29tZS1kb21haW4uY29tLw==',
            value: 'domain.com/path/_pages/thing'
          });
        });
    });

    it('finds the site without locals', function () {
      var pageData = {
        layout: 'domain.com/path/_layouts/thing',
        main: [ 'domain.com/path/_components/foo' ]
      };

      layouts.get.returns(Promise.resolve({}));
      components.get.returns(Promise.resolve());
      db.getLatestData.returns(Promise.resolve());
      db.batch.returns(Promise.resolve());
      notifications.notify.returns(Promise.resolve());
      publishService.resolvePublishUrl.returns(() => Promise.resolve({
        meta: { url: 'http://some-domain.com/' },
        data: pageData
      }));
      meta.publishPage.returns(Promise.resolve());
      siteService.getSiteFromPrefix.returns(locals.site);

      return fn('domain.com/path/_pages/thing@published', pageData, {})
        .then(() => {
          const ops = db.batch.args[0][0],
            secondLastOp = ops[ops.length - 2];

          sinon.assert.calledOnce(siteService.getSiteFromPrefix);
          expect(secondLastOp).to.deep.equal({
            type: 'put',
            key: 'domain.com/path/_uris/c29tZS1kb21haW4uY29tLw==',
            value: 'domain.com/path/_pages/thing'
          });
        });
    });

    it('publishes dynamic pages', function () {
      const pageData = { layout: 'domain.com/path/_layouts/thing', _dynamic: true };

      layouts.get.returns(Promise.resolve({}));
      db.getLatestData.returns(Promise.resolve());
      db.batch.returns(Promise.resolve());
      notifications.notify.returns(Promise.resolve());
      publishService.resolvePublishUrl.returns(() => Promise.resolve({
        meta: {},
        data: pageData
      }));
      meta.publishPage.returns(Promise.resolve());

      return fn('domain.com/path/_pages/thing@published', pageData, locals)
        .then(() => {
          const ops = db.batch.args[0][0],
            secondLastOp = ops[ops.length - 2];

          expect(secondLastOp).to.not.deep.equal({
            type: 'put',
            key: 'domain.com/path/_uris/c29tZS1kb21haW4uY29tLw==',
            value: 'domain.com/path/_pages/thing'
          });
        });
    });

    it('warns if publish is slow', function () {
      const pageData = {layout: 'domain.com/path/_layouts/thing'};

      layouts.get.returns(Promise.resolve({}));
      db.get.returns(Promise.resolve());
      db.batch.returns(Promise.resolve());
      notifications.notify.returns(Promise.resolve());
      timer.getMillisecondsSince.returns(timeoutConstant * 7);
      publishService.resolvePublishUrl.returns(() => Promise.resolve({
        meta: { url: 'http://some-domain.com/' },
        data: pageData
      }));
      meta.publishPage.returns(Promise.resolve());

      return fn('domain.com/path/_pages/thing@published', pageData, locals)
        .then(() => {
          sinon.assert.calledWith(fakeLog, 'warn', sinon.match('slow publish domain.com/path/_pages/thing@published 700ms'));
        });
    });

    it('logs if publish is not slow', function () {
      var pageData = {layout: 'domain.com/path/_layouts/thing'};

      layouts.get.returns(Promise.resolve({}));
      db.get.returns(Promise.resolve());
      db.batch.returns(Promise.resolve());
      notifications.notify.returns(Promise.resolve());
      timer.getMillisecondsSince.returns(20);
      publishService.resolvePublishUrl.returns(() => Promise.resolve({
        meta: { url: 'http://some-domain.com/' },
        data: pageData
      }));
      meta.publishPage.returns(Promise.resolve());

      return fn('domain.com/path/_pages/thing@published', pageData, locals)
        .then(function () {
          sinon.assert.calledWith(fakeLog, 'info', sinon.match('published domain.com/path/_pages/thing 20ms'));
        });
    });

    it('throws on empty data', function (done) {
      var pageData = {layout: 'domain.com/path/_layouts/thing', head: ['']};

      layouts.get.returns(Promise.resolve({}));
      db.batch.returns(Promise.resolve());
      siteService.getSiteFromPrefix.returns({notify: _.noop});
      publishService.resolvePublishUrl.returns(Promise.resolve(Object.assign(pageData, { url: 'http://some-domain.com/'})));

      fn('domain.com/path/_pages/thing@published', pageData, { site: {} })
        .then(done)
        .catch(function (result) {
          expect(result.message).to.equal('Client: page cannot have empty values');
          done();
        });
    });

    it('publishes with provided data', function () {
      var pageData = {layout: 'domain.com/path/_layouts/thing'};

      layouts.get.returns(Promise.resolve({}));
      db.get.returns(Promise.resolve());
      db.batch.returns(Promise.resolve());
      siteService.getSiteFromPrefix.returns({notify: _.noop});
      notifications.notify.returns(Promise.resolve());
      publishService.resolvePublishUrl.returns(() => Promise.resolve({
        meta: { url: 'http://some-domain.com/' },
        data: pageData
      }));
      meta.publishPage.returns(Promise.resolve());

      return fn('domain.com/path/_pages/thing@published', pageData, locals)
        .then(function (result) {
          expect(result.layout).to.equal('domain.com/path/_layouts/thing@published');
        });
    });

    it('publishes without provided data', function () {
      var pageData = {
        layout: 'domain.com/path/_components/thing@published'
      };

      layouts.get.returns(Promise.resolve({}));
      db.get.returns(Promise.resolve({layout: 'domain.com/path/_layouts/thing', url: 'http://some-domain.com'}));
      db.batch.returns(Promise.resolve());
      siteService.getSiteFromPrefix.returns({notify: _.noop});
      notifications.notify.returns(Promise.resolve());
      publishService.resolvePublishUrl.returns(() => Promise.resolve({
        meta: { url: 'http://some-domain.com/' },
        data: pageData
      }));
      meta.publishPage.returns(Promise.resolve());

      return fn('domain.com/path/_pages/thing@published', {}, locals).then(result => {
        expect(result).to.deep.equal(pageData);
      });
    });

    it('throws when a sites publishing chain does not provide a url', function () {
      layouts.get.returns(Promise.resolve({}));
      db.batch.returns(Promise.resolve());
      siteService.getSiteFromPrefix.returns({notify: _.noop});
      notifications.notify.returns(Promise.resolve());
      publishService.resolvePublishUrl.returns(() => Promise.resolve({
        meta: {},
        data: {
          layout: 'domain.com/path/_components/thing@published'
        }
      }));
      meta.publishPage.returns(Promise.resolve());

      return fn('domain.com/path/_pages/thing@published', {layout: 'domain.com/path/_layouts/thing'}, { site: {} })
        .catch(result => {
          expect(result.message).to.equal('Client: Page must have valid url to publish.');
        });
    });

    it('throws when a sites publishing chain returns an invalid url', function () {
      components.get.returns(bluebird.resolve({}));
      db.batch.returns(bluebird.resolve());
      siteService.getSiteFromPrefix.returns({notify: _.noop});
      notifications.notify.returns(bluebird.resolve());
      publishService.resolvePublishUrl.returns(() => Promise.resolve({
        meta: { url: 'womp&com'},
        data: {
          layout: 'domain.com/path/_components/thing@published'
        }
      }));

      return fn('domain.com/path/_pages/thing@published', {layout: 'domain.com/path/_components/thing', url: 'foo/bar/baz' }, { site: {} })
        .catch(function (result) {
          expect(result.message).to.equal('Client: Page must have valid url to publish.');
        });
    });
  });

  describe('replacePageReferenceVersions', function () {
    const fn = lib[this.title];

    it('adds version', function () {
      expect(fn({a: 'b'}, 'c')).to.deep.equal({ a: 'b@c' });
    });

    it('removes version', function () {
      expect(fn({a: 'b@c'})).to.deep.equal({ a: 'b' });
    });

    it('adds version in array', function () {
      expect(fn({a: ['b']}, 'c')).to.deep.equal({ a: ['b@c'] });
    });

    it('removes version in array', function () {
      expect(fn({a: ['b@c']})).to.deep.equal({ a: ['b'] });
    });

    it('ignores object type', function () {
      expect(fn({a: {b: 'bad data'}}, 'c')).to.deep.equal({ a: { b: 'bad data' } });
    });

    it('ignores boolean type', function () {
      expect(fn({a: true})).to.deep.equal({a: true});
    });
  });

  describe('putLatest', function () {
    const fn = lib[this.title];

    it('passes through if page already exists', function () {
      db.getLatestData.returns(Promise.resolve({}));
      db.put.returns(Promise.resolve());

      return fn('domain.com/path/pages', {layout: 'domain.com/path/_layouts/thing'})
        .then(() => {
          sinon.assert.notCalled(bus.publish);
        });
    });

    it('calls create hook if page does not exist', function () {
      db.getLatestData.returns(Promise.reject());
      db.put.returns(Promise.resolve());

      return fn('domain.com/path/pages', {layout: 'domain.com/path/_layouts/thing'}).then(function () {
        sinon.assert.calledOnce(bus.publish);
        expect(bus.publish.getCall(0).args[0]).to.equal('createPage');
      });
    });

    it('errors if the page does not have a layout', () => {
      const result = () => fn('domain.com/path/pages', {layout: 'domain.com/path/_components/thing'});

      expect(result).to.throw(Error);
    });
  });
});
