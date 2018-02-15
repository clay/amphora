'use strict';

const _ = require('lodash'),
  sinon = require('sinon'),
  expect = require('chai').expect,
  filename = __filename.split('/').pop().split('.').shift(),
  db = require('../services/db'),
  lib = require(`./${filename}`);

describe(_.startCase(filename), function () {
  let sandbox,
    fakeSite,
    pubRule,
    modifyFn;

  function makeFakeSite() {
    pubRule = sandbox.stub();
    modifyFn = sandbox.stub();

    fakeSite = {
      resolvePublishUrl: [
        pubRule
      ],
      modifyPublishedData: [
        modifyFn
      ]
    };
  }

  beforeEach(function () {
    sandbox = sinon.sandbox.create();
    sandbox.stub(db);

    makeFakeSite();
  });

  afterEach(function () {
    sandbox.restore();
  });

  describe('resolvePublishUrl', function () {
    it('returns page data when a site has no `resolvePublishUrl` function', function functionName() {
      const fakePage = { page: 'data', url: 'http://cool/url' };

      return lib('some/uri', {}, {})(_.cloneDeep(fakePage))
        .then(function (resp) {
          expect(resp).to.eql(fakePage);
        });
    });

    it('executes a publish rule if one is provided', function () {
      const fakePage = {page: 'data'},
        fakeUrl = 'http://some.url';

      pubRule.returns(fakeUrl);
      modifyFn.returnsArg(0);
      db.get.returns(Promise.resolve(JSON.stringify(fakePage)));

      return lib('some/uri', {}, fakeSite)(_.cloneDeep(fakePage))
        .then(function (resp) {
          sinon.assert.calledOnce(pubRule);
          expect(resp).to.eql(_.assign(fakePage, {url: fakeUrl,urlHistory: [ fakeUrl ] }));
        });
    });

    it('throws an error if one occurs anywhere in the process', function () {
      const fakePage = {page: 'data'},
        fakeUrl = 'http://some.url';

      pubRule.returns(fakeUrl);
      modifyFn.rejects(new Error('An error occured'));
      db.get.returns(Promise.resolve(JSON.stringify(fakePage)));

      return lib('some/uri', {}, fakeSite)(_.cloneDeep(fakePage))
        .catch(function (e) {
          sinon.assert.calledOnce(pubRule);
          expect(e.message).to.equal('An error occured');
        });

    });

    it('adds redirects if needed', function () {
      const fakeHistory = ['http://old.url', 'http://old2.url'],
        fakePage = {page: 'data', urlHistory: fakeHistory},
        fakeUrl = 'http://some.url';

      pubRule.returns(fakeUrl);
      modifyFn.returnsArg(0);
      db.get.returns(Promise.resolve(JSON.stringify(fakePage)));

      return lib('some/uri', {}, fakeSite)(_.cloneDeep(fakePage))
        .then(function () {
          sinon.assert.calledOnce(db.put);
        });
    });

    it('does not update history if the url is not new', function () {
      const fakeUrl = 'http://some.url',
        fakeHistory = ['http://old.url', fakeUrl],
        fakePage = {page: 'data', urlHistory: fakeHistory};

      pubRule.returns(fakeUrl);
      modifyFn.returnsArg(0);
      db.get.returns(Promise.resolve(JSON.stringify(fakePage)));

      return lib('some/uri', {}, fakeSite)(_.cloneDeep(fakePage))
        .then(function (resp) {
          expect(resp).to.eql(_.assign(fakePage, {url: fakeUrl}));
        });
    });

    it('if the page data cannot be retrieved no history will be on the page', function () {
      const fakeUrl = 'http://some.url',
        fakePage = {page: 'data', url: fakeUrl};

      pubRule.returns(fakeUrl);
      modifyFn.returnsArg(0);
      db.get.rejects(new Error('not found'));

      return lib('some/uri', {}, fakeSite)(_.cloneDeep(fakePage))
        .then(function (resp) {
          expect(resp).to.eql(_.assign(fakePage, {urlHistory: [fakeUrl]}));
        });
    });
  });

  describe('modifyPublishedData', function () {
    const fn = lib[this.title];

    it('returns the data passed in if no modifiers are defined', function () {
      const fakeData = {test: 'data'};

      return fn({}, fakeData)
        .then(function (resp) {
          expect(resp).to.eql(fakeData);
        });
    });

    it('throws an error if there is a problem with the modifier', function () {
      const fakeData = {test: 'data'};

      modifyFn.rejects(new Error('An error occured'));
      return fn(fakeSite, fakeData)
        .catch(function (e) {
          expect(e.message).to.equal('An error occured');
        });
    });
  });

  describe('getPassthroughPageUrl', function () {
    const fn = lib[this.title];

    it('rejects when no url or customUrl are defined', function () {
      return fn('a/uri', {})
        .catch(function (e) {
          expect(e.message).to.equal('All pages need a url or customUrl to publish');
        });
    });

    it('returns a customUrl if one is defined', function () {
      return fn('a/uri', {customUrl: 'cool/url'})
        .then(function (resp) {
          expect(resp).to.equal('cool/url');
        });
    });

    it('returns a url value if one is defined and custom url is not', function () {
      return fn('a/uri', {url: 'cool/url'})
        .then(function (resp) {
          expect(resp).to.equal('cool/url');
        });
    });
  });
});
