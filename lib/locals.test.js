'use strict';

const _startCase = require('lodash/startCase'),
  filename = __filename.split('/').pop().split('.').shift(),
  lib = require('./' + filename),
  expect = require('chai').expect,
  sinon = require('sinon'),
  files = require('./files');

describe(_startCase(filename), function () {
  let sandbox, mockRes;

  beforeEach(function () {
    mockRes = { locals: {} };
    sandbox = sinon.sandbox.create();
  });

  afterEach(function () {
    sandbox.restore();
  });

  function checkLocalsProperty(res, property, expected) {
    return () => expect(res.locals[property]).to.deep.equal(expected);
  }

  describe('addAvailableRoutes', function () {
    const fn = lib[this.title];

    it('adds no routes if no routes defined', function () {
      fn({ stack: [] })({}, mockRes, checkLocalsProperty(mockRes, 'routes', []));
    });

    it('adds no routes if no routes have route properties', function () {
      fn({ stack: [{}] })({}, mockRes, checkLocalsProperty(mockRes, 'routes', []));
    });

    it('adds no routes if no routes have paths', function () {
      fn({ stack: [{ route: {} }] })({}, mockRes, checkLocalsProperty(mockRes, 'routes', []));
    });

    it('adds routes to locals', function () {
      fn({ stack: [{ route: { path: '/foo' } }] })({}, mockRes, checkLocalsProperty(mockRes, 'routes', ['/foo']));
    });
  });

  describe('addAvailableComponents', function () {
    const fn = lib[this.title];

    it('adds available components to locals', function () {
      sandbox.stub(files, 'getComponents').returns(['foo', 'bar']);

      fn({}, mockRes, checkLocalsProperty(mockRes, 'components', ['foo', 'bar']));
    });

    it('adds no components to locals if there are no available components', function () {
      sandbox.stub(files, 'getComponents').returns([]);

      fn({}, mockRes, checkLocalsProperty(mockRes, 'components', []));
    });
  });

  describe('addSiteData', function () {
    const fn = lib[this.title];

    it('adds url and site data to locals', function () {
      const site = { host: 'foo.com', protocol: 'http', port: 80 },
        req = { hostname: 'foo.com', originalUrl: '/path?param=bar'},
        next = sandbox.stub();

      fn(site)(req, mockRes, next);

      expect(mockRes.locals.site).to.deep.equal(site);
      expect(mockRes.locals.url).to.equal('http://foo.com/path?param=bar');
      sinon.assert.calledOnce(next);
    });
  });

  describe('addQueryParams', function () {
    const fn = lib[this.title];

    it('adds query params to locals', function () {
      const req = { params: { userId: 'foo1234' }, query: { edit: true } },
        next = sandbox.stub();

      fn(req, mockRes, next);

      expect(mockRes.locals.userId).to.equal('foo1234');
      expect(mockRes.locals.edit).to.equal(true);
      sinon.assert.calledOnce(next);
    });
  });

  describe('addUser', function () {
    const fn = lib[this.title];

    it('adds query params to locals', function () {
      const req = { user: { username: 'foo', provider: 'local' } };

      fn(req, mockRes, checkLocalsProperty(mockRes, 'user', req.user));
    });
  });
});
