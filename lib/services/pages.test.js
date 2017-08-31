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
  winston = require('winston');

describe(_.startCase(filename), function () {
  const timeoutConstant = 100;
  let sandbox,
    savedTimeoutConstant;

  beforeEach(function () {
    sandbox = sinon.sandbox.create();
    sandbox.stub(db);
    sandbox.stub(components, 'get');
    sandbox.stub(siteService, 'getSiteFromPrefix');
    sandbox.stub(notifications, 'notify');
    sandbox.stub(timer);
    sandbox.stub(winston);

    savedTimeoutConstant = lib.getTimeoutConstant();
    lib.setTimeoutConstant(timeoutConstant);
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

      return fn('domain.com/path/pages', {layout: 'domain.com/path/components/thing'}).then(function (result) {
        expect(result._ref).to.match(/^domain.com\/path\/pages\//);
        delete result._ref;
        expect(result).to.deep.equal({layout: 'domain.com/path/components/thing'});
      });
    });

    it('creates with content', function () {
      const uri = 'domain.com/path/pages',
        contentUri = 'domain.com/path/components/thing1',
        layoutUri = 'domain.com/path/components/thing2',
        data = { layout: layoutUri, content: contentUri },
        contentData = {},
        layoutReferenceData = {};

      components.get.withArgs(layoutUri).returns(bluebird.resolve(layoutReferenceData));
      components.get.withArgs(contentUri).returns(bluebird.resolve(contentData));
      db.batch.returns(bluebird.resolve());
      siteService.getSiteFromPrefix.returns({notify: _.noop});

      return fn(uri, data).then(function (result) {
        // self reference is returned, but in a new instance with a new name
        expect(result._ref).to.match(/^domain\.com\/path\/pages\//);

        // layout will be the same
        expect(result.layout).to.equal(layoutUri);

        // new data will be put into a new instance
        expect(result.content).to.match(/^domain\.com\/path\/components\/thing1\/instances\//);
      });
    });

    it('creates with content with inner references', function () {
      const uri = 'domain.com/path/pages',
        contentUri = 'domain.com/path/components/thing1',
        layoutUri = 'domain.com/path/components/thing2',
        innerContentUri = 'domain.com/path/components/thing3',
        innerContentInstanceUri = 'domain.com/path/components/thing4/instances/thing5',
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
        expect(result._ref).to.match(/^domain\.com\/path\/pages\//);
        expect(result.layout).to.equal(layoutUri);
        expect(result.content).to.match(/^domain\.com\/path\/components\/thing1\/instances\//);

        // This is complex, I know, but we're cloning things and giving them a random name -- Testing random is difficult.
        // There should be three ops, each has a unique instance key, and each writes to a unique ref.
        // Non-instance references are ignored

        const batchOps = db.batch.args[0][0];

        expect(batchOps[0].key).to.match(new RegExp('domain.com/path/components/thing4/instances/'));
        expect(batchOps[0].type).to.equal('put');
        expect(JSON.parse(batchOps[0].value)).to.deep.equal(innerContentInstanceData);

        expect(batchOps[1].key).to.match(new RegExp('domain.com/path/components/thing1/instances/'));
        expect(batchOps[1].type).to.equal('put');
        expect(JSON.parse(batchOps[1].value).thing).to.deep.equal({_ref: innerContentUri});
        expect(JSON.parse(batchOps[1].value).instanceThing._ref).to.match(new RegExp('domain.com/path/components/thing4/instances/'));

        expect(batchOps[2].key).to.match(new RegExp('domain.com/path/pages/'));
        expect(batchOps[2].type).to.equal('put');
        expect(JSON.parse(batchOps[2].value).layout).to.equal(layoutUri);
        expect(JSON.parse(batchOps[2].value).content).to.match(new RegExp('domain.com/path/components/thing1/instances/'));
      });
    });
  });

  describe('publish', function () {
    const fn = lib[this.title];

    it('creates relevant uri', function () {
      components.get.returns(bluebird.resolve({}));
      db.batch.returns(bluebird.resolve());
      notifications.notify.returns(bluebird.resolve());

      return fn('domain.com/path/pages/thing@published', {layout: 'domain.com/path/components/thing'},
        {
          site: {
            resolvePublishing: () => [ function (uri, data) { data.url = 'http://some-domain.com'; return data; } ]
          }
        }).then(function () {
        const ops = db.batch.args[0][0],
          secondLastOp = ops[ops.length - 2];

        expect(secondLastOp).to.deep.equal({
          type: 'put',
          key: 'domain.com/path/uris/c29tZS1kb21haW4uY29tLw==',
          value: 'domain.com/path/pages/thing'
        });
      });
    });

    it('warns if publish is slow', function () {
      components.get.returns(bluebird.resolve({}));
      db.batch.returns(bluebird.resolve());
      notifications.notify.returns(bluebird.resolve());
      timer.getMillisecondsSince.returns(timeoutConstant * 7);

      return fn('domain.com/path/pages/thing@published', {layout: 'domain.com/path/components/thing'},
        {
          site: {
            resolvePublishing: () => [ function (uri, data) { data.url = 'http://some-domain.com'; return data; } ]
          }
        }).then(function () {
        sinon.assert.calledWith(winston.log, 'warn', sinon.match('slow publish domain.com/path/pages/thing@published 700ms'));
      });
    });

    it('logs if publish is not slow', function () {
      components.get.returns(bluebird.resolve({}));
      db.batch.returns(bluebird.resolve());
      notifications.notify.returns(bluebird.resolve());
      timer.getMillisecondsSince.returns(20);

      return fn('domain.com/path/pages/thing@published', {layout: 'domain.com/path/components/thing'},
        {
          site: {
            resolvePublishing: () => [ function (uri, data) { data.url = 'http://some-domain.com'; return data; } ]
          }
        }).then(function () {
        sinon.assert.calledWith(winston.log, 'info', sinon.match('published domain.com/path/pages/thing 20ms'));
      });
    });

    it('warns if notification fails', function () {
      const site = {},
        uri = 'domain.com/path/pages/thing@published';

      components.get.returns(bluebird.resolve({}));
      db.batch.returns(bluebird.resolve());
      siteService.getSiteFromPrefix.returns(site);
      notifications.notify.returns(bluebird.reject(new Error('hello!')));

      return fn(uri, {layout: 'domain.com/path/components/thing'},
        {
          site: {
            resolvePublishing: () => [ function (uri, data) { data.url = 'http://some-domain.com'; return data; } ]
          }
        }).then(function () {
        sinon.assert.calledWith(winston.log, 'warn');
        sinon.assert.calledTwice(winston.log); // it's called once with info
      });
    });

    it('notifies', function () {
      const site = {
          resolvePublishing: () => [ function (uri, data) { data.url = 'http://some-domain.com'; return data; } ]
        },
        uri = 'domain.com/path/pages/thing@published';

      components.get.returns(bluebird.resolve({}));
      db.batch.returns(bluebird.resolve());
      siteService.getSiteFromPrefix.returns(site);
      notifications.notify.returns(bluebird.resolve());

      return fn(uri, {layout: 'domain.com/path/components/thing'},
        {
          site: site
        }).then(function (result) {
        sinon.assert.calledWith(notifications.notify, site, 'published', result);
      });
    });

    it('throws on empty data', function (done) {
      components.get.returns(bluebird.resolve({}));
      db.batch.returns(bluebird.resolve());
      siteService.getSiteFromPrefix.returns({notify: _.noop});

      fn('domain.com/path/pages/thing@published', {layout: 'domain.com/path/components/thing', head: ['']}, { site: {} })
        .then(done)
        .catch(function (result) {
          expect(result.message).to.equal('Client: page cannot have empty values');
          done();
        });
    });

    it('publishes with provided data', function () {
      components.get.returns(bluebird.resolve({}));
      db.batch.returns(bluebird.resolve());
      siteService.getSiteFromPrefix.returns({notify: _.noop});
      notifications.notify.returns(bluebird.resolve());

      return fn('domain.com/path/pages/thing@published', {layout: 'domain.com/path/components/thing'},
        {
          site: {
            resolvePublishing: () => [ function (uri, data) { data.url = 'http://some-domain.com'; return data; } ]
          }
        }).then(function (result) {
        expect(result.layout).to.equal('domain.com/path/components/thing@published');
      });
    });

    it('publishes without provided data', function () {
      components.get.returns(bluebird.resolve({}));
      db.get.returns(bluebird.resolve(JSON.stringify({layout: 'domain.com/path/components/thing', url: 'http://some-domain.com'})));
      db.batch.returns(bluebird.resolve());
      siteService.getSiteFromPrefix.returns({notify: _.noop});
      notifications.notify.returns(bluebird.resolve());

      return fn('domain.com/path/pages/thing@published', {}, {
        site: {
          resolvePublishing: () => [ function (uri, data) { data.url = 'http://some-domain.com'; return data; } ]
        }
      }).then(function (result) {
        expect(result).to.deep.equal({layout: 'domain.com/path/components/thing@published', url: 'http://some-domain.com'});
      });
    });

    it('throws when a sites publishing chain does not provide a url', function (done) {
      components.get.returns(bluebird.resolve({}));
      db.batch.returns(bluebird.resolve());
      siteService.getSiteFromPrefix.returns({notify: _.noop});
      notifications.notify.returns(bluebird.resolve());

      fn('domain.com/path/pages/thing@published', {layout: 'domain.com/path/components/thing'},
        { site: {resolvePublishing: () => [ function (uri, data) { return data; } ]} }).then(done)
        .catch(function (result) {
          expect(result.message).to.equal('Client: Page must have valid url to publish.');
          done();
        });
    });

    it('throws when a publishing chain exists but no options ', function (done) {
      components.get.returns(bluebird.resolve({}));
      db.batch.returns(bluebird.resolve());
      siteService.getSiteFromPrefix.returns({notify: _.noop});
      notifications.notify.returns(bluebird.resolve());

      fn('domain.com/path/pages/thing@published', {layout: 'domain.com/path/components/thing'},
        {
          site: {
            resolvePublishing: () => [ function () { return bluebird.reject(new Error('url error')); } ]
          }
        }).then(done)
        .catch(function (result) {
          expect(result.message).to.equal('Client: Page must have valid url to publish.');
          done();
        });
    });

    it('throws when a site does not provide a resolvePublishing function to modify the publishing chain', function (done) {
      components.get.returns(bluebird.resolve({}));
      db.batch.returns(bluebird.resolve());
      siteService.getSiteFromPrefix.returns({notify: _.noop});
      notifications.notify.returns(bluebird.resolve());

      fn('domain.com/path/pages/thing@published', {layout: 'domain.com/path/components/thing'},
        {
          site: {}
        }).then(done)
        .catch(function (result) {
          expect(result.message).to.equal('Client: Page must have valid url to publish.');
          done();
        });
    });

    it('throws when the resolvePublishing function exists but does not return an array', function (done) {
      components.get.returns(bluebird.resolve({}));
      db.batch.returns(bluebird.resolve());
      siteService.getSiteFromPrefix.returns({notify: _.noop});
      notifications.notify.returns(bluebird.resolve());

      fn('domain.com/path/pages/thing@published', {layout: 'domain.com/path/components/thing'},
        {
          site: {
            resolvePublishing: () => undefined
          }
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
});
