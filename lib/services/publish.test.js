'use strict';

const _ = require('lodash'),
  sinon = require('sinon'),
  expect = require('chai').expect,
  filename = __filename.split('/').pop().split('.').shift(),
  lib = require(`./${filename}`),
  storage = require('../../test/fixtures/mocks/storage'),
  meta = require('./metadata');

describe(_.startCase(filename), function () {
  let sandbox,
    fakeSite,
    pubRule,
    modifyFn,
    db,
    fakeLog,
    rule1, rule2, rule3;

  function makeFakeSite() {
    pubRule  = sandbox.stub();
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
    db = storage();
    rule1 = sandbox.stub();
    rule2 = sandbox.stub();
    rule3 = sandbox.stub();
    fakeLog  = sandbox.stub();
    sandbox.stub(meta, 'getMeta');

    lib.setLog(fakeLog);
    lib.setDb(db);
    makeFakeSite();
  });

  afterEach(function () {
    sandbox.restore();
  });

  describe('processPublishRules', function () {
    const fn = lib[this.title];

    it('does not process all rules once one resolves', function () {
      rule1.returns(Promise.reject(new Error(0)));
      rule2.returns(Promise.resolve('foo.com/bar/baz'));

      const uri = 'http://example.com/uri@published';

      db.getMeta.returns(Promise.resolve({ archived: false }));

      return fn([ () => Promise.reject(new Error(0)), rule2, rule3 ], uri)
        .then(() => {
          sinon.assert.notCalled(rule3);
          sinon.assert.calledOnce(rule2);
        });
    });

    it('does not process if archived is true', function () {
      rule1.returns(Promise.reject(new Error(0)));
      rule2.returns(Promise.resolve('foo.com/bar/baz'));

      const uri = 'http://example.com/uri@published';

      db.getMeta.returns(Promise.resolve({ archived: true }));

      return fn([ rule1, rule2, rule3 ], uri)
        .then(() => {
          sinon.assert.notCalled(rule1);
          sinon.assert.notCalled(rule2);
          sinon.assert.notCalled(rule3);
        });
    });
  });

  describe('validatePublishRules', function () {
    const fn = lib[this.title];

    it('logs all a warning if there are errors', function () {
      const errors = {
        0: 'some error',
        _checkForDynamicPage: 'a cool error'
      };

      return fn('someuri', {val: '', errors })
        .catch(err => {
          expect(err.status).to.equal(400);
          sinon.assert.calledWith(fakeLog, 'error', 'Error publishing page: someuri', {
            publishRuleErrors: errors
          });
        });
    });
  });

  describe('resolvePublishUrl', function () {
    it('only checks internal methods if no rules are supplied', function () {
      const fakeUrl = 'http://some.url',
        fakePage = {page: 'data', url: fakeUrl };

      pubRule.returns(fakeUrl);
      modifyFn.returnsArg(0);
      db.get.returns(Promise.resolve(JSON.stringify(fakePage)));
      meta.getMeta.returns(Promise.resolve({}));
      db.getMeta.returns(Promise.resolve({ archived: false }));

      return lib.resolvePublishUrl('some/uri', {}, {})(_.cloneDeep(fakePage))
        .then(resp => expect(resp).to.eql({ data: fakePage, meta: { url: 'http://some.url', urlHistory: ['http://some.url'] }}));
    });

    it('executes a publish rule if one is provided', function () {
      const fakePage = {page: 'data'},
        fakeUrl = 'http://some.url';

      pubRule.returns(fakeUrl);
      modifyFn.returnsArg(0);
      db.get.returns(Promise.resolve(fakePage));
      meta.getMeta.returns(Promise.resolve({}));
      db.getMeta.returns(Promise.resolve({ archived: false }));

      return lib.resolvePublishUrl('some/uri', {}, fakeSite)(_.cloneDeep(fakePage))
        .then(resp => {
          sinon.assert.calledOnce(pubRule);
          expect(resp).to.eql({ data: fakePage, meta: { url: fakeUrl, urlHistory: [fakeUrl] }});
        });
    });

    it('adds redirects if needed', function () {
      const fakeHistory = ['http://old.url', 'http://old2.url'],
        fakePage = {page: 'data'},
        fakeUrl = 'http://some.url';

      pubRule.returns(fakeUrl);
      modifyFn.returnsArg(0);
      db.put.returns(Promise.resolve());
      meta.getMeta.returns(Promise.resolve({
        urlHistory: fakeHistory
      }));
      db.getMeta.returns(Promise.resolve({ archived: false }));

      return lib.resolvePublishUrl('some/uri', {}, fakeSite)(_.cloneDeep(fakePage))
        .then(() => {
          sinon.assert.calledOnce(db.put);
        });
    });

    it('does not update history if the url is not new', function () {
      const fakeUrl = 'http://some.url',
        fakeHistory = ['http://old.url', fakeUrl],
        fakePage = {page: 'data'};

      pubRule.returns(fakeUrl);
      modifyFn.returnsArg(0);
      db.put.returns(Promise.resolve());
      meta.getMeta.returns(Promise.resolve({
        urlHistory: fakeHistory
      }));
      db.getMeta.returns(Promise.resolve({ archived: false }));

      return lib.resolvePublishUrl('some/uri', {}, fakeSite)(_.cloneDeep(fakePage))
        .then(resp => {
          expect(resp).to.eql({ data: fakePage, meta: { url: fakeUrl, urlHistory: fakeHistory }});
        });
    });

    it('if the page data cannot be retrieved no history will be on the page', function () {
      const fakeUrl = 'http://some.url',
        fakePage = {page: 'data', url: fakeUrl};

      pubRule.returns(fakeUrl);
      modifyFn.returnsArg(0);
      meta.getMeta.returns(Promise.resolve({}));
      db.getMeta.returns(Promise.resolve({ archived: false }));

      return lib.resolvePublishUrl('some/uri', {}, fakeSite)(_.cloneDeep(fakePage))
        .then(resp => {
          expect(resp).to.eql({ data: fakePage, meta: { url: fakeUrl, urlHistory: [fakeUrl] }});
        });
    });

    it('allows for publishing a dynamic page', function () {
      const fakePage = {page: 'data', _dynamic: true},
        locals = {};

      db.getMeta.returns(Promise.resolve({ archived: false }));

      return lib.resolvePublishUrl('some/uri', locals, fakeSite)(_.cloneDeep(fakePage))
        .then(resp => {
          expect(resp.meta._dynamic).to.be.true;
          expect(locals.isDynamicPublishUrl).to.be.true;
        });
    });
  });

  describe('addToMeta', function () {
    const fn = lib[this.title];

    it('reduces through modifiers and assigns them to the meta', function () {
      const func = sandbox.stub().returns({});

      return fn({}, [func], 'someUri', {})
        .then(() => {
          sinon.assert.calledWith(func, 'someUri', {}, {});
        });
    });
  });

  describe('_checkForUrlProperty', function () {
    const fn = lib[this.title];

    it('rejects when no url or customUrl are defined', function () {
      return fn('a/uri', {})
        .catch(function (e) {
          expect(e.message).to.equal('Page does not have a `url` or `customUrl` property set');
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

  describe('_checkForDynamicPage', function () {
    const fn = lib[this.title];

    it('rejects if _dynamic is not defined', function () {
      return fn('some/_pages/uri', {})
        .catch(err => {
          expect(err.message).to.eql('Page is not dynamic and requires a url');
        });
    });

    it('rejects if _dynamic is not a boolean defined', function () {
      return fn('some/_pages/uri', {_dynamic: 'true'})
        .catch(err => {
          expect(err.message).to.eql('Page is not dynamic and requires a url');
        });
    });

    it('resolves true when _dynamic is a truthy boolean', function () {
      return fn('some/_pages/uri', {_dynamic: true})
        .then(resp => {
          expect(typeof resp).to.equal('boolean');
          expect(resp).to.be.true;
        });
    });
  });

  describe('_checkForArchived', function () {
    const fn = lib[this.title];

    it('rejects with an error object if the meta.archived property is true', function () {
      const uri = 'http://example.com/uri@published';

      db.getMeta.returns(Promise.resolve({ archived: true }));

      return fn(uri)
        .catch(err => {
          const expectedErr = { val:'', errors: { _checkForArchived: 'The page is archived and cannot be published' } };

          expect(err).to.eql(expectedErr);
        });
    });

    it('resolves with an empty error object if the meta.archived property is false', function () {
      const uri = 'http://example.com/uri@published';

      db.getMeta.returns(Promise.resolve({ archived: false }));

      return fn(uri)
        .then(resp => expect(resp).to.eql({ val:'', errors: {} }));
    });
  });
});
