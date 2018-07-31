'use strict';

const _ = require('lodash'),
  filename = __filename.split('/').pop().split('.').shift(),
  lib = require('./' + filename),
  sinon = require('sinon'),
  expect = require('chai').expect;

describe(_.startCase(filename), function () {
  const testRoutes = [
      { path: '/' },
      { path: '/:foo' },
      { path: '/section/' },
      { path: '/section', redirect: '/section/' },
      { path: '/news/:tag', dynamicPage: 'somePageId' }
    ],
    siteConfigMock = {};

  let sandbox;

  beforeEach(function () {
    sandbox = sinon.sandbox.create();
  });

  afterEach(function () {
    sandbox.restore();
  });

  describe('attachRoutes', function () {
    it('attaches routes if passed in', function () {
      const paths = [],
        router = {
          get(path) {
            // testing if the paths are added,
            // we're checking the paths array after each test
            paths.push(path);
          }
        };

      lib(router, testRoutes, siteConfigMock);
      expect(paths.length).to.equal(testRoutes.length);
    });

    it('calls res.redirect if a redirect is specified', function () {
      const testRoutes = [
          { path: '/section', redirect: '/section/' },
        ],
        fakeRes = {
          redirect: sandbox.spy()
        },
        router = {
          get(path, fn) {
            // We're testing that redirect will get called,
            // so we need to fake invocation of the handler
            fn(undefined, fakeRes);
          }
        };

      lib(router, testRoutes, siteConfigMock);
      sinon.assert.calledOnce(fakeRes.redirect);
    });
  });

  describe('normalizeRedirectPath', () => {
    const mockSites = [
      {
        path: ''
      },
      {
        path: '/some-path'
      }
    ];

    it('should add path to redirect if site has a path', () => {
      const redirect = '/some-redirect/',
        site = mockSites[1];

      expect(lib.normalizeRedirectPath(redirect, site)).to.equal('/some-path/some-redirect/');
    });

    it('should not add path to redirect if site has no path', () => {
      const redirect = '/some-redirect/',
        site = mockSites[0];

      expect(lib.normalizeRedirectPath(redirect, site)).to.equal('/some-redirect/');
    });

    it('should not add path to redirect if redirect already has the path set', () => {
      const redirect = '/some-path/some-redirect/',
        site = mockSites[0];

      expect(lib.normalizeRedirectPath(redirect, site)).to.equal('/some-path/some-redirect/');
    });
  });
});
