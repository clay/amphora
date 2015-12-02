'use strict';

var _ = require('lodash'),
  bluebird = require('bluebird'),
  components = require('./components'),
  db = require('../services/db'),
  expect = require('chai').expect,
  filename = __filename.split('/').pop().split('.').shift(),
  lib = require('./' + filename),
  sinon = require('sinon'),
  siteService = require('./sites');

describe(_.startCase(filename), function () {
  var sandbox;

  beforeEach(function () {
    sandbox = sinon.sandbox.create();
    sandbox.stub(db);
    sandbox.stub(components, 'get');
    sandbox.stub(siteService, 'getSiteFromPrefix');
  });

  afterEach(function () {
    sandbox.restore();
  });

  describe('create', function () {
    var fn = lib[this.title];

    it('notifies', function () {
      const site = {notify: sinon.spy()};

      components.get.returns(bluebird.resolve({}));
      db.batch.returns(bluebird.resolve());
      siteService.getSiteFromPrefix.returns(site);

      return fn('domain.com/path/pages', {layout: 'domain.com/path/components/thing'}).then(function () {
        sinon.assert.calledOnce(site.notify);
      });
    });

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
      var uri = 'domain.com/path/pages',
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
      var uri = 'domain.com/path/pages',
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

        var batchOps = db.batch.args[0][0];

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
    var fn = lib[this.title];

    it('notifies', function () {
      const site = {notify: sinon.spy()},
        uri = 'domain.com/path/pages/thing';

      components.get.returns(bluebird.resolve({}));
      db.batch.returns(bluebird.resolve());
      siteService.getSiteFromPrefix.returns(site);

      return fn(uri, {layout: 'domain.com/path/components/thing', url: 'http://some-domain.com'}).then(function (result) {
        sinon.assert.calledWith(site.notify, {
          type: 'put',
          key: uri + '@published',
          value: JSON.stringify(result)
        });
      });
    });

    it('publishes with provided data', function () {
      components.get.returns(bluebird.resolve({}));
      db.batch.returns(bluebird.resolve());
      siteService.getSiteFromPrefix.returns({notify: _.noop});

      return fn('domain.com/path/pages/thing', {layout: 'domain.com/path/components/thing', url: 'http://some-domain.com'}).then(function (result) {
        expect(result).to.deep.equal({layout: 'domain.com/path/components/thing@published', url: 'http://some-domain.com'});
      });
    });

    it('publishes without provided data', function () {
      components.get.returns(bluebird.resolve({}));
      db.get.returns(bluebird.resolve(JSON.stringify({layout: 'domain.com/path/components/thing', url: 'http://some-domain.com'})));
      db.batch.returns(bluebird.resolve());
      siteService.getSiteFromPrefix.returns({notify: _.noop});

      return fn('domain.com/path/pages/thing').then(function (result) {
        expect(result).to.deep.equal({layout: 'domain.com/path/components/thing@published', url: 'http://some-domain.com'});
      });
    });

    it('throws if missing url with provided data', function (done) {
      components.get.returns(bluebird.resolve({}));
      db.batch.returns(bluebird.resolve());
      siteService.getSiteFromPrefix.returns({notify: _.noop});

      fn('domain.com/path/pages/thing', {layout: 'domain.com/path/components/thing'}).then(done).catch(function (error) {
        expect(error).to.be.an.instanceof(Error);
        done();
      });
    });

    it('throws if missing url without provided data', function (done) {
      components.get.returns(bluebird.resolve({}));
      db.get.returns(bluebird.resolve(JSON.stringify({layout: 'domain.com/path/components/thing'})));
      db.batch.returns(bluebird.resolve());
      siteService.getSiteFromPrefix.returns({notify: _.noop});

      fn('domain.com/path/pages/thing').then(done).catch(function (error) {
        expect(error).to.be.an.instanceof(Error);
        done();
      });
    });
  });

  describe('replacePageReferenceVersions', function () {
    var fn = lib[this.title];

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