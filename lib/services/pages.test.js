'use strict';

const _ = require('lodash'),
  bluebird = require('bluebird'),
  components = require('./components'),
  db = require('../services/db'),
  expect = require('chai').expect,
  filename = __filename.split('/').pop().split('.').shift(),
  lib = require('./' + filename),
  notifications = require('./notifications'),
  sinon = require('sinon'),
  siteService = require('./sites'),
  timer = require('../timer'),
  plugins = require('../plugins'),
  schema = require('../schema');

describe(_.startCase(filename), function () {
  const timeoutConstant = 100;
  let sandbox,
    savedTimeoutConstant,
    fakeLog;

  beforeEach(function () {
    sandbox = sinon.sandbox.create();
    fakeLog = sandbox.stub();
    sandbox.stub(db);
    sandbox.stub(components, 'get');
    sandbox.stub(siteService, 'getSiteFromPrefix');
    sandbox.stub(notifications, 'notify');
    sandbox.stub(timer);
    sandbox.stub(plugins);
    sandbox.stub(schema);

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

    it('creates without content', function () {
      components.get.returns(bluebird.resolve({}));
      db.batch.returns(bluebird.resolve());
      siteService.getSiteFromPrefix.returns({notify: _.noop});

      return fn('domain.com/path/_pages', {layout: 'domain.com/path/_components/thing'}).then(function (result) {
        expect(result._ref).to.match(/^domain.com\/path\/_pages\//);
        delete result._ref;
        expect(result).to.deep.equal({layout: 'domain.com/path/_components/thing'});
      });
    });

    it('creates with content', function () {
      const uri = 'domain.com/path/_pages',
        contentUri = 'domain.com/path/_components/thing1',
        layoutUri = 'domain.com/path/_components/thing2',
        data = { layout: layoutUri, content: contentUri },
        contentData = {},
        layoutReferenceData = {};

      components.get.withArgs(layoutUri).returns(bluebird.resolve(layoutReferenceData));
      components.get.withArgs(contentUri).returns(bluebird.resolve(contentData));
      db.batch.returns(bluebird.resolve());
      siteService.getSiteFromPrefix.returns({notify: _.noop});

      return fn(uri, data).then(function (result) {
        // self reference is returned, but in a new instance with a new name
        expect(result._ref).to.match(/^domain\.com\/path\/_pages\//);

        // layout will be the same
        expect(result.layout).to.equal(layoutUri);

        // new data will be put into a new instance
        expect(result.content).to.match(/^domain\.com\/path\/_components\/thing1\/instances\//);
      });
    });

    it('creates with content with inner references', function () {
      const uri = 'domain.com/path/_pages',
        contentUri = 'domain.com/path/_components/thing1',
        layoutUri = 'domain.com/path/_components/thing2',
        innerContentUri = 'domain.com/path/_components/thing3',
        innerContentInstanceUri = 'domain.com/path/_components/thing4/instances/thing5',
        data = { layout: layoutUri, content: contentUri },
        contentData = { thing: {_ref: innerContentUri}, instanceThing: {_ref: innerContentInstanceUri}},
        layoutReferenceData = {},
        innerContentInstanceData = {more: 'data'};

      components.get.withArgs(layoutUri).returns(bluebird.resolve(layoutReferenceData));
      components.get.withArgs(contentUri).returns(bluebird.resolve(contentData));
      components.get.withArgs(innerContentInstanceUri).returns(bluebird.resolve(innerContentInstanceData));
      db.batch.returns(bluebird.resolve());
      siteService.getSiteFromPrefix.returns({notify: _.noop});


      return fn(uri, data).then(function (result) {
        expect(result._ref).to.match(/^domain\.com\/path\/_pages\//);
        expect(result.layout).to.equal(layoutUri);
        expect(result.content).to.match(/^domain\.com\/path\/_components\/thing1\/instances\//);

        // This is complex, I know, but we're cloning things and giving them a random name -- Testing random is difficult.
        // There should be three ops, each has a unique instance key, and each writes to a unique ref.
        // Non-instance references are ignored

        const batchOps = db.batch.args[0][0];

        expect(batchOps[0].key).to.match(new RegExp('domain.com/path/_components/thing4/instances/'));
        expect(batchOps[0].type).to.equal('put');
        expect(JSON.parse(batchOps[0].value)).to.deep.equal(innerContentInstanceData);

        expect(batchOps[1].key).to.match(new RegExp('domain.com/path/_components/thing1/instances/'));
        expect(batchOps[1].type).to.equal('put');
        expect(JSON.parse(batchOps[1].value).thing).to.deep.equal({_ref: innerContentUri});
        expect(JSON.parse(batchOps[1].value).instanceThing._ref).to.match(new RegExp('domain.com/path/_components/thing4/instances/'));

        expect(batchOps[2].key).to.match(new RegExp('domain.com/path/_pages/'));
        expect(batchOps[2].type).to.equal('put');
        expect(JSON.parse(batchOps[2].value).layout).to.equal(layoutUri);
        expect(JSON.parse(batchOps[2].value).content).to.match(new RegExp('domain.com/path/_components/thing1/instances/'));
      });
    });
  });

  describe('publish', function () {
    const fn = lib[this.title],
      locals = {
        site: {
          resolvePublishUrl: [ () => Promise.resolve('http://some-domain.com') ]
        }
      };

    it('creates relevant uri', function () {
      components.get.returns(bluebird.resolve({}));
      db.get.returns(Promise.reject());
      db.batch.returns(bluebird.resolve());
      notifications.notify.returns(bluebird.resolve());

      return fn('domain.com/path/_pages/thing@published', {layout: 'domain.com/path/_components/thing'}, locals)
        .then(function () {
          const ops = db.batch.args[0][0],
            secondLastOp = ops[ops.length - 2];

          expect(secondLastOp).to.deep.equal({
            type: 'put',
            key: 'domain.com/path/_uris/c29tZS1kb21haW4uY29tLw==',
            value: 'domain.com/path/_pages/thing'
          });
        });
    });

    it('publishes dynamic pages', function () {
      components.get.returns(bluebird.resolve({}));
      db.get.returns(Promise.reject());
      db.batch.returns(bluebird.resolve());
      notifications.notify.returns(bluebird.resolve());

      return fn('domain.com/path/_pages/thing@published', {layout: 'domain.com/path/_components/thing', _dynamic: true}, locals)
        .then(function () {
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
      components.get.returns(bluebird.resolve({}));
      db.get.returns(Promise.reject());
      db.batch.returns(bluebird.resolve());
      notifications.notify.returns(bluebird.resolve());
      timer.getMillisecondsSince.returns(timeoutConstant * 7);

      return fn('domain.com/path/_pages/thing@published', {layout: 'domain.com/path/_components/thing'}, locals)
        .then(function () {
          sinon.assert.calledWith(fakeLog, 'warn', sinon.match('slow publish domain.com/path/_pages/thing@published 700ms'));
        });
    });

    it('logs if publish is not slow', function () {
      components.get.returns(bluebird.resolve({}));
      db.get.returns(Promise.reject());
      db.batch.returns(bluebird.resolve());
      notifications.notify.returns(bluebird.resolve());
      timer.getMillisecondsSince.returns(20);

      return fn('domain.com/path/_pages/thing@published', {layout: 'domain.com/path/_components/thing'}, locals)
        .then(function () {
          sinon.assert.calledWith(fakeLog, 'info', sinon.match('published domain.com/path/_pages/thing 20ms'));
        });
    });

    it('warns if notification fails', function () {
      const site = {},
        uri = 'domain.com/path/_pages/thing@published';

      components.get.returns(bluebird.resolve({}));
      db.get.returns(Promise.reject());
      db.batch.returns(bluebird.resolve());
      siteService.getSiteFromPrefix.returns(site);
      notifications.notify.returns(bluebird.reject(new Error('hello!')));

      return fn(uri, {layout: 'domain.com/path/_components/thing'}, locals)
        .then(function () {
          sinon.assert.calledWith(fakeLog, 'warn');
          sinon.assert.calledTwice(fakeLog); // it's called once with info
        });
    });

    it('notifies', function () {
      const uri = 'domain.com/path/_pages/thing@published';

      components.get.returns(bluebird.resolve({}));
      db.get.returns(Promise.reject());
      db.batch.returns(bluebird.resolve());
      siteService.getSiteFromPrefix.returns({});
      notifications.notify.returns(bluebird.resolve());

      return fn(uri, {layout: 'domain.com/path/_components/thing'}, locals)
        .then(function (result) {
          sinon.assert.calledWith(notifications.notify, locals.site, 'published', result);
        });
    });

    it('throws on empty data', function (done) {
      components.get.returns(bluebird.resolve({}));
      db.batch.returns(bluebird.resolve());
      siteService.getSiteFromPrefix.returns({notify: _.noop});

      fn('domain.com/path/_pages/thing@published', {layout: 'domain.com/path/_components/thing', head: ['']}, { site: {} })
        .then(done)
        .catch(function (result) {
          expect(result.message).to.equal('Client: page cannot have empty values');
          done();
        });
    });

    it('publishes with provided data', function () {
      components.get.returns(bluebird.resolve({}));
      db.get.returns(Promise.reject());
      db.batch.returns(bluebird.resolve());
      siteService.getSiteFromPrefix.returns({notify: _.noop});
      notifications.notify.returns(bluebird.resolve());

      return fn('domain.com/path/_pages/thing@published', {layout: 'domain.com/path/_components/thing'}, locals)
        .then(function (result) {
          expect(result.layout).to.equal('domain.com/path/_components/thing@published');
        });
    });

    it('publishes without provided data', function () {
      components.get.returns(bluebird.resolve({}));
      db.get.returns(bluebird.resolve(JSON.stringify({layout: 'domain.com/path/_components/thing', url: 'http://some-domain.com'})));
      db.batch.returns(bluebird.resolve());
      siteService.getSiteFromPrefix.returns({notify: _.noop});
      notifications.notify.returns(bluebird.resolve());

      return fn('domain.com/path/_pages/thing@published', {}, locals).then(function (result) {
        expect(result).to.deep.equal({
          layout: 'domain.com/path/_components/thing@published',
          url: 'http://some-domain.com',
          urlHistory: [ 'http://some-domain.com' ]
        });
      });
    });

    it('throws when a sites publishing chain does not provide a url', function () {
      components.get.returns(bluebird.resolve({}));
      db.batch.returns(bluebird.resolve());
      siteService.getSiteFromPrefix.returns({notify: _.noop});
      notifications.notify.returns(bluebird.resolve());

      return fn('domain.com/path/_pages/thing@published', {layout: 'domain.com/path/_components/thing'}, { site: {} })
        .catch(function (result) {
          expect(result.message).to.equal('Client: Page must have valid url to publish.');
        });
    });

    it('throws when a site does not provide a resolvePublishing function to modify the publishing chain', function (done) {
      components.get.returns(bluebird.resolve({}));
      db.batch.returns(bluebird.resolve());
      siteService.getSiteFromPrefix.returns({notify: _.noop});
      notifications.notify.returns(bluebird.resolve());

      fn('domain.com/path/_pages/thing@published', {layout: 'domain.com/path/_components/thing'},
        {
          site: {}
        }).then(done)
        .catch(function (result) {
          expect(result.message).to.equal('Client: Page must have valid url to publish.');
          done();
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
      db.get.returns(bluebird.resolve('{}'));
      db.put.returns(bluebird.resolve());
      schema.getSchema.returns(Promise.resolve({ _layout: true }));

      return fn('domain.com/path/pages', {layout: 'domain.com/path/components/thing'}).then(function () {
        expect(plugins.executeHook.called).to.equal(false);
      });
    });

    it('calls create hook if page does not exist', function () {
      db.get.returns(bluebird.reject());
      db.put.returns(bluebird.resolve());
      schema.getSchema.returns(Promise.resolve({ _layout: true }));

      return fn('domain.com/path/pages', {layout: 'domain.com/path/components/thing'}).then(function () {
        expect(plugins.executeHook.called).to.equal(true);
        expect(plugins.executeHook.getCall(0).args[0]).to.equal('createPage');
      });
    });

    it('warns if referenced layout is not a real layout (false)', () => {
      db.get.returns(bluebird.resolve('{}'));
      db.put.returns(bluebird.resolve());
      schema.getSchema.returns(Promise.resolve({ _layout: false }));

      return fn('domain.com/path/pages', {layout: 'domain.com/path/components/thing'}).then(function () {
        sinon.assert.calledWith(fakeLog, 'warn', sinon.match('layout must specify \'_layout: true\' in its schema: domain.com/path/components/thing'));
      });
    });

    it('warns if referenced layout is not a real layout (undefined)', () => {
      db.get.returns(bluebird.resolve('{}'));
      db.put.returns(bluebird.resolve());
      schema.getSchema.returns(Promise.resolve({}));

      return fn('domain.com/path/pages', {layout: 'domain.com/path/components/thing'}).then(function () {
        sinon.assert.calledWith(fakeLog, 'warn', sinon.match('layout must specify \'_layout: true\' in its schema: domain.com/path/components/thing'));
      });
    });

    it('warns if referenced layout is not a real layout (reject)', () => {
      db.get.returns(bluebird.resolve('{}'));
      db.put.returns(bluebird.resolve());
      schema.getSchema.returns(Promise.reject());

      return fn('domain.com/path/pages', {layout: 'domain.com/path/components/thing'}).then(function () {
        sinon.assert.calledWith(fakeLog, 'warn', sinon.match('layout must specify \'_layout: true\' in its schema: domain.com/path/components/thing'));
      });
    });
  });
});
