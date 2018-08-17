'use strict';

const _ = require('lodash'),
  filename = __filename.split('/').pop().split('.').shift(),
  lib = require('./' + filename),
  sinon = require('sinon'),
  expect = require('chai').expect;

describe(_.startCase(filename), () => {
  const mockSubRouter = {},
    mockMiddleware1 = {},
    mockMiddleware2 = {},
    testMiddleware = [
      { isRouter: true, middleware: mockSubRouter },
      { path: '/', middleware: mockMiddleware1 },
      { path: ['/', '/some-path'], middleware: [mockMiddleware1, mockMiddleware2] },
    ];

  describe('enforceArray', () => {
    it('converts a non array value to array', () => {
      const someValue = 'someValue';

      expect(lib.enforceArray(someValue)).to.deep.equal([someValue]);
    });

    it('returns value as it is if it is an array', () => {
      const someValue = ['someValue'];

      expect(lib.enforceArray(someValue)).to.deep.equal(someValue);
    });
  });

  describe('parseMiddleware', () => {
    let sandbox;

    beforeEach(function () {
      sandbox = sinon.sandbox.create();
    });

    afterEach(function () {
      sandbox.restore();
    });

    it('should add router to main router', () => {
      const middlewareConfig = testMiddleware[0],
        mainRouterMock = {
          get: sandbox.spy(),
          use: sandbox.spy()
        };

      lib.parseMiddleware(mainRouterMock, middlewareConfig);

      expect(mainRouterMock.use.callCount).to.equal(1);
      expect(mainRouterMock.use.calledWith(middlewareConfig.middleware));
    });

    it('should add middleware to main router', () => {
      const middlewareConfig = testMiddleware[1],
        mainRouterMock = {
          get: sandbox.spy(),
          use: sandbox.spy()
        };

      lib.parseMiddleware(mainRouterMock, middlewareConfig);

      expect(mainRouterMock.get.callCount).to.equal(1);
      expect(mainRouterMock.get.calledWith(middlewareConfig.path, middlewareConfig.middleware));
    });

    it('should add many middleware with many routes to main router', () => {
      const middlewareConfig = testMiddleware[2],
        mainRouterMock = {
          get: sandbox.spy(),
          use: sandbox.spy()
        };

      lib.parseMiddleware(mainRouterMock, middlewareConfig);

      expect(mainRouterMock.get.callCount).to.equal(2);
      expect(mainRouterMock.get.firstCall.calledWith(middlewareConfig.path[0], middlewareConfig.middleware[0]));
      expect(mainRouterMock.get.secondCall.calledWith(middlewareConfig.path[1], middlewareConfig.middleware[1]));
    });
  });
});
