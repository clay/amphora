'use strict';
const _ = require('lodash'),
  filename = __filename.split('/').pop().split('.').shift(),
  lib = require('./' + filename),
  expect = require('chai').expect,
  sinon = require('sinon'),
  files = require('./files'),
  siteService = require('./services/sites'),
  express = require('express');

function createMockRouter() {
  return {
    use: sinon.stub(),
    all: _.noop,
    get: _.noop,
    put: _.noop,
    post: _.noop,
    delete: _.noop
  };
}

describe(_.startCase(filename), function () {
  let sandbox, fakeLog, fakeAuth;

  beforeEach(function () {
    sandbox = sinon.sandbox.create();
    fakeLog = sandbox.stub();
    fakeAuth = sandbox.stub();
    fakeAuth.addRoutes = sandbox.stub();

    lib.setLog(fakeLog);
    lib.setamphoraAuth(fakeAuth);
  });

  afterEach(function () {
    sandbox.restore();
  });

  describe('addCORS', function () {
    const fn = lib[this.title];

    it('calls next with no settings', function (done) {
      const test = fn({});

      test({ headers: {} }, {}, done);
    });

    it('responds to Origin header with Access-Control-Allow-Origin', function (done) {
      const spy = sandbox.spy(),
        test = fn({});

      test({ headers: { origin: 'whatever' } }, { header: spy }, done);

      sinon.assert.calledWith(spy, 'Access-Control-Allow-Origin', '*');
    });

    it('responds to OPTIONS method', function (done) {
      let res,
        spy = sandbox.spy(),
        test = fn({});

      res = {
        header: spy,
        status() {
          return res;
        },
        send: done
      };

      test({ method: 'OPTIONS', headers: {} }, res);

      sinon.assert.calledWith(spy, 'Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,PATCH,OPTIONS');
      sinon.assert.calledWith(spy, 'Access-Control-Allow-Headers', sinon.match.string);
    });
  });

  describe('sortByDepthOfPath', function () {
    const fn = lib[this.title];

    it('greater than', function () {
      expect(fn({ path: '1/1' }, { path: '1' })).to.equal(1);
    });

    it('equal', function () {
      expect(fn({ path: '01' }, { path: '1' })).to.equal(0);
    });

    it('less than', function () {
      expect(fn({ path: '1' }, { path: '1/1' })).to.equal(-1);
    });
  });

  describe('getDefaultSiteSettings', function () {
    const fn = lib[this.title];

    it('www.example.com', function () {
      const hostname = 'www.example.com';

      expect(fn(hostname)).to.deep.equal({
        assetDir: 'public',
        host: hostname,
        name: 'Example',
        path: '/',
        prefix: 'www.example.com',
        slug: 'example'
      });
    });
  });

  describe('addSite', function () {
    const fn = lib[this.title];

    it('adds controllers', function () {
      const router = createMockRouter(),
        innerRouter = createMockRouter();

      sandbox.stub(express, 'Router').callsFake(_.constant(innerRouter));
      sandbox.stub(files, 'fileExists');
      sandbox.stub(files, 'tryRequire');
      sandbox.stub(files, 'getFiles');
      sandbox.stub(files, 'getComponents');
      sandbox.stub(siteService, 'sites');

      files.fileExists.returns(true);
      files.tryRequire.returns(_.noop);
      files.getFiles.returns(['a.b, c.d, e.f']);

      fn(
        router,
        { providers: [] },
        { slug: 'example', assetDir: 'example' }
      );
      sinon.assert.notCalled(files.tryRequire);
    });

    it('inits auth if there are providers', function () {
      const router = createMockRouter(),
        innerRouter = createMockRouter(),
        siteStub = { slug: 'example', assetDir: 'example' };

      sandbox.stub(express, 'Router').callsFake(_.constant(innerRouter));
      sandbox.stub(files, 'fileExists');
      sandbox.stub(files, 'tryRequire');
      sandbox.stub(files, 'getFiles');
      sandbox.stub(files, 'getComponents');
      sandbox.stub(siteService, 'sites');

      files.fileExists.returns(true);
      files.tryRequire.returns(_.noop);
      files.getFiles.returns(['a.b, c.d, e.f']);

      return fn(
        router,
        { providers: ['ldap'] },
        siteStub
      ).then(function () {
        sinon.assert.called(fakeAuth);
      });
    });

    it('adds middlewares', function () {
      const router = createMockRouter(),
        innerRouter = createMockRouter(),
        siteStub = { slug: 'example', dir: '/example', assetDir: 'example' };

      sandbox.stub(express, 'Router').callsFake(_.constant(innerRouter));
      sandbox.stub(files, 'fileExists');
      sandbox.stub(files, 'tryRequire');
      sandbox.stub(files, 'getFiles');
      sandbox.stub(files, 'getComponents');
      sandbox.stub(siteService, 'sites');

      files.fileExists.returns(true);
      files.tryRequire.onCall(0).returns({
        middleware: [_.noop]
      });
      files.tryRequire.returns(_.noop);
      files.getFiles.returns(['a.b, c.d, e.f']);

      return fn(router, { providers: ['ldap'] }, siteStub)
        .then(function () {
          sinon.assert.called(innerRouter.use);
        });
    });

    it('does not apply site controllers if there is no site config', function () {
      const router = createMockRouter(),
        innerRouter = createMockRouter(),
        siteStub = { slug: 'example', dir: '/example', assetDir: 'example' };

      sandbox.stub(express, 'Router').callsFake(_.constant(innerRouter));
      sandbox.stub(files, 'fileExists');
      sandbox.stub(files, 'tryRequire');
      sandbox.stub(files, 'getFiles');
      sandbox.stub(files, 'getComponents');
      sandbox.stub(siteService, 'sites');

      files.fileExists.returns(true);
      files.tryRequire.onCall(0).returns(null);
      files.tryRequire.returns(_.noop);
      files.getFiles.returns(['a.b, c.d, e.f']);

      return fn(
        router,
        { providers: ['ldap'] },
        siteStub
      ).then(function () {
        expect(files.tryRequire.callCount).to.equal(6);
      });
    });

    it('throws on bad site', function () {
      const router = createMockRouter(),
        innerRouter = createMockRouter();

      sandbox.stub(express, 'Router').callsFake(_.constant(innerRouter));
      sandbox.stub(files, 'fileExists');
      sandbox.stub(files, 'tryRequire');
      sandbox.stub(files, 'getComponents');
      sandbox.stub(siteService, 'sites');

      files.fileExists.returns(true);
      siteService.sites.returns({
        example: {
          slug: 'example',
          assetDir: 'example'
        }
      });

      expect(function () {
        fn(router, [], null, { slug: 'badsite' });
      }).to.throw();
    });

    it('throws on missing asset folder', function () {
      const router = createMockRouter(),
        innerRouter = createMockRouter();

      sandbox.stub(express, 'Router').callsFake(_.constant(innerRouter));
      sandbox.stub(files, 'fileExists');
      sandbox.stub(files, 'tryRequire');
      sandbox.stub(files, 'getComponents');
      sandbox.stub(siteService, 'sites');

      files.fileExists.returns(false);
      siteService.sites.returns({
        example: {
          slug: 'example',
          assetDir: 'example'
        }
      });

      expect(function () {
        fn(router, [], null, { slug: 'example' });
      }).to.throw();
    });
  });

  describe('loadFromConfig', function () {
    const fn = lib;

    it('is missing the site router but still works', function () {
      const router = createMockRouter(),
        innerRouter = createMockRouter();

      sandbox.stub(express, 'Router').callsFake(_.constant(innerRouter));
      sandbox.stub(files, 'fileExists');
      sandbox.stub(files, 'tryRequire');
      sandbox.stub(siteService, 'sites');

      files.fileExists.returns(true);
      files.tryRequire.returns(_.noop);
      siteService.sites.returns({
        example: {
          host: 'example',
          slug: 'example',
          assetDir: 'example',
          dir: 'example'
        }
      });

      fn(router, []);
    });

    it('has the site router but it is a noop', function () {
      const router = createMockRouter(),
        innerRouter = createMockRouter();

      sandbox.stub(express, 'Router').callsFake(_.constant(innerRouter));
      sandbox.stub(files, 'fileExists');
      sandbox.stub(files, 'tryRequire');
      sandbox.stub(siteService, 'sites');

      files.tryRequire.returns(_.noop);
      files.fileExists.returns(true);
      siteService.sites.returns({
        example: {
          host: 'example',
          slug: 'example',
          assetDir: 'example',
          dir: 'example'
        }
      });

      fn(router, []);
    });
  });

  describe('addSiteController', function () {
    const fn = lib[this.title];

    it('does nothing if there is no site directory', function () {
      const router = {},
        site = {};

      fn(router, site);
    });

    it('does nothing if loading site controller fails', function () {
      const siteDir = 'some-location',
        router = {},
        site = { dir: siteDir };

      sandbox.stub(files, 'tryRequire');

      files.tryRequire.returns(false);

      fn(router, site);
    });

    it('does nothing if site controller is not a function', function () {
      const siteDir = 'some-location',
        router = {},
        site = { dir: siteDir };

      sandbox.stub(files, 'tryRequire');

      files.tryRequire.returns({});

      fn(router, site);
    });

    it('calls `attachRoutes` if the `routes` Array is defined', function () {
      const siteDir = 'some-location',
        paths = [],
        router = {
          get(route) {
            paths.push(route);
          }
        },
        site = { dir: siteDir };

      sandbox.stub(files, 'tryRequire');

      files.tryRequire.returns({
        routes: [{ path: '/foo/bar' }]
      });

      fn(router, site);
      expect(paths[0]).to.equal('/foo/bar');
    });

    it('attaches middleware if the `middleware` Array is defined', function () {
      const siteDir = 'some-location',
        paths = [],
        middlewares = [],
        router = {
          get(route) {
            paths.push(route);
          },
          use(route, middleware) {
            middlewares.push(middleware);
            return route;
          }
        },
        site = { dir: siteDir };

      sandbox.stub(files, 'tryRequire');

      files.tryRequire.returns({
        routes: [{ path: '/foo/bar' }],
        middleware: [_.noop]
      });

      fn(router, site);
      expect(middlewares.length).to.equal(1);
    });

    it('remembers resolveMedia from controller', function () {
      const siteDir = 'some-location',
        router = {},
        site = { dir: siteDir };

      sandbox.stub(files, 'tryRequire');

      files.tryRequire.returns({});

      fn(router, site);
    });
  });

  describe('addAuthenticationRoutes', function () {
    const fn = lib[this.title];

    it('should add /_users routes', function () {
      const router = createMockRouter();

      fn(router);

      sinon.assert.callCount(fakeAuth.addRoutes, 1);
      sinon.assert.calledWith(router.use, '/_users');
    });
  });
});
