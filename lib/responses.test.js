'use strict';

const _ = require('lodash'),
  filename = __filename.split('/').pop().split('.').shift(),
  lib = require('./' + filename),
  db = require('./services/db'),
  expect = require('chai').expect,
  sinon = require('sinon'),
  bluebird = require('bluebird'),
  filter = require('through2-filter'),
  createMockReq = require('../test/fixtures/mocks/req'),
  createMockRes = require('../test/fixtures/mocks/res');

describe(_.startCase(filename), function () {
  let sandbox, fakeLog;

  /**
   * Shortcut
   *
   * @param {object} res
   * @param {number} code
   */
  function expectStatus(res, code) {
    sandbox.mock(res).expects('status').withArgs(code).returns(res).atLeast(1);
  }

  /**
   * Shortcut
   */
  function expectNoLogging() {
    sinon.assert.notCalled(fakeLog);
  }

  /**
   *
   * @param {object} res
   * @param {string} type
   */
  function expectContentType(res, type) {
    sandbox.mock(res).expects('type').withArgs(sinon.match(type)).once();
  }

  /**
   * Shortcut
   *
   * @param {object} res
   * @param {object} expected
   * @param {Function} done
   */
  function expectResult(res, expected, done) {
    sandbox.stub(res, 'send', function (result) {
      sandbox.verify();
      expect(result).to.deep.equal(expected);
      done();
    });
  }

  beforeEach(function () {
    sandbox = sinon.sandbox.create();
    fakeLog = sandbox.stub();
    lib.setLog(fakeLog);
  });

  afterEach(function () {
    sandbox.restore();
  });

  describe('removeQueryString', function () {
    const fn = lib[this.title];

    it('basic case', function () {
      expect(fn('something?something')).to.equal('something');
    });
  });

  describe('removeExtension', function () {
    const fn = lib[this.title];

    it('basic case', function () {
      expect(fn('something.something')).to.equal('something');
    });
  });

  describe('normalizePath', function () {
    const fn = lib[this.title];

    it('allows version', function () {
      expect(fn('something@something')).to.equal('something@something');
    });
  });

  describe('handleError', function () {
    const fn = lib[this.title];

    it('sends 404 if "not found"', function (done) {
      const res = createMockRes();

      expectStatus(res, 404);
      expectResult(res, 'sendStatus: whatever', function () {
        expectNoLogging();
        done();
      });
      fn(res)(new Error('not found'));
    });

    it('sends 500 and logs error', function (done) {
      const res = createMockRes();

      expectStatus(res, 500);
      expectResult(res, 'sendStatus: whatever', function () {
        sinon.assert.calledWith(fakeLog, 'error');
        done();
      });
      fn(res)(new Error('something'));
    });
  });

  describe('unauthorized', function () {
    const fn = lib[this.title];

    it('sends 401', function (done) {
      const res = createMockRes();

      expectStatus(res, 401);
      expectResult(res, 'sendStatus: whatever', function () {
        expectNoLogging();
        done();
      });
      fn(res);
    });
  });

  describe('clientError', function () {
    const fn = lib[this.title];

    it('sends 400', function (done) {
      const res = createMockRes();

      expectStatus(res, 400);
      expectResult(res, 'sendStatus: whatever', function () {
        expectNoLogging();
        done();
      });
      fn(new Error('something'), res);
    });
  });

  describe('serverError', function () {
    const fn = lib[this.title];

    it('sends 500 and logs error', function (done) {
      const res = createMockRes();

      expectStatus(res, 500);
      expectResult(res, 'sendStatus: whatever', function () {
        sinon.assert.calledWith(fakeLog, 'error');
        done();
      });
      fn(new Error('something'), res);
    });

    it('returns "Server Error" message', function (done) {
      const res = createMockRes();

      var err = new Error('something');

      // Reset the error message to test for default response
      err.message = '';
      expectStatus(res, 500);
      expectResult(res, 'sendStatus: whatever', function () {
        sinon.assert.calledWith(fakeLog, 'error');
        done();
      });
      fn(err, res);
    });
  });

  describe('notImplemented', function () {
    const fn = lib[this.title];

    it('sends 501', function (done) {
      const res = createMockRes();

      expectStatus(res, 501);
      expectResult(res, 'sendStatus: whatever', function () {
        expectNoLogging();
        done();
      });
      fn({}, res);
    });
  });

  describe('varyWithoutExtension', function () {
    const fn = lib[this.title];

    it('adds vary without extension', function (done) {
      const req = createMockReq(),
        res = createMockRes();

      req.path = '/hey';


      sandbox.mock(res).expects('set').withArgs('Vary', 'whatever').once();
      fn({varyBy: ['whatever']})(req, res, function () {
        sandbox.verify();
        expectNoLogging();
        done();
      });
    });

    it('does not add vary with extension', function (done) {
      const req = createMockReq(),
        res = createMockRes();

      req.path = '/hey.html';

      sandbox.mock(res).expects('set').withArgs('Vary', sinon.match.any).never();
      fn({varyBy: ['whatever']})(req, res, function () {
        sandbox.verify();
        expectNoLogging();
        done();
      });
    });
  });

  describe('methodNotAllowed', function () {
    const fn = lib[this.title];

    it('blocks when not allowed', function (done) {
      const allowed = ['something'],
        req = createMockReq(),
        res = createMockRes({formatter: 'json'});

      req.method = 'somethingElse';

      expectStatus(res, 405);
      expectResult(res, {
        allow: allowed,
        code: 405,
        message: 'Method somethingElse not allowed'
      }, function () {
        expectNoLogging();
        done();
      });
      fn({allow: allowed})(req, res);
    });

    it('does not block when allowed', function (done) {
      const req = createMockReq(),
        res = createMockRes({formatter: 'json'});

      req.method = 'something';

      fn({allow: ['something']})(req, res, function () {
        expectNoLogging();
        done();
      });
    });
  });

  describe('expectJSON', function () {
    const fn = lib[this.title];

    it('sends json', function (done) {
      const data = {},
        res = createMockRes({formatter: 'json'});

      expectResult(res, data, function () {
        expectNoLogging();
        done();
      });
      fn(function () {
        return data;
      }, res);
    });

    it('404s on Error "not found"', function (done) {
      const res = createMockRes({formatter: 'json'});

      expectStatus(res, 404);
      expectResult(res, {
        message: 'Not Found',
        code: 404
      }, function () {
        expectNoLogging();
        done();
      });
      fn(function () {
        throw Error('something not found: etc etc');
      }, res);
    });
  });

  describe('list', function () {
    const fn = lib[this.title];

    beforeEach(function () {
      return db.clear().then(function () {
        return bluebird.join(
          db.put('base/a', 'b'),
          db.put('base/aa', 'b'),
          db.put('base/aaa', 'b'),
          db.put('base/c', 'd'),
          db.put('base/cc', 'd'),
          db.put('base/ccc', 'd'),
          db.put('base/e', 'f')
        );
      });
    });

    it('uses uri as prefix if no options given', function (done) {
      const req = createMockReq(),
        res = createMockRes();

      req.hostname = 'base.com';
      req.path = '/a';
      res.locals.site = {host: 'base.com', path: '/a', slug: 'base'};

      expectResult(res, '["base/a","base/aa","base/aaa","base/c","base/cc","base/ccc","base/e"]', function () {
        expectNoLogging();
        done();
      });
      fn()(req, res);
    });

    it('should use prefix in options if given', function (done) {
      const req = createMockReq(),
        res = createMockRes();

      req.hostname = 'base.com';
      req.path = '/a';
      res.locals.site = {host: req.hostname, path: req.path, slug: 'base'};

      expectResult(res, '["base/cc","base/ccc"]', done);
      fn({prefix: 'base/c'})(req, res);
    });

    it('can filter results if given appropriate transform', function (done) {
      const req = createMockReq(),
        res = createMockRes(),
        onlyCFilter = filter({wantStrings: true}, function (str) { return str.indexOf('/c') !== -1; });

      req.hostname = 'base.com';
      req.path = '/';
      res.locals.site = {host: req.hostname, path: req.path, slug: 'base'};

      expectResult(res, '["base/c","base/cc","base/ccc"]', function () {
        expectNoLogging();
        done();
      });
      fn({transforms: [onlyCFilter]})(req, res);
    });
  });

  describe('listUsers', function () {
    const fn = lib[this.title],
      expected = [
        '/_users/a',
        '/_users/aa',
        '/_users/aaa',
        '/_users/c',
        '/_users/cc',
        '/_users/ccc',
        '/_users/e'
      ];

    beforeEach(function () {
      return db.clear().then(function () {
        return bluebird.join(
          db.put('/_users/a', 'b'),
          db.put('/_users/aa', 'b'),
          db.put('/_users/aaa', 'b'),
          db.put('/_users/c', 'd'),
          db.put('/_users/cc', 'd'),
          db.put('/_users/ccc', 'd'),
          db.put('/_users/e', 'f')
        );
      });
    });

    it('lists users under a domain', function (done) {
      const req = createMockReq(),
        res = createMockRes();

      req.hostname = 'base.com';
      req.path = '/_users/';

      expectResult(res, JSON.stringify(_.map(expected, user => `${req.hostname}${user}`)), function () {
        expectNoLogging();
        done();
      });
      fn()(req, res);
    });

    it('lists users under a domain with a path', function (done) {
      const req = createMockReq(),
        res = createMockRes();

      req.hostname = 'base.com';
      req.path = '/some/path/_users/';

      expectResult(res, JSON.stringify(_.map(expected, user => `${req.hostname}/some/path${user}`)), function () {
        expectNoLogging();
        done();
      });
      fn()(req, res);
    });
  });

  describe('expectResponseType', function () {
    const fn = lib[this.title];

    it('sends whichever type is passed in', function (done) {
      const data = 'some html',
        func = function () {
          return bluebird.resolve({
            type: 'html',
            output: data
          });
        },
        res = createMockRes({formatter: 'html'});

      expectContentType(res, /html/);
      expectResult(res, data, function () {
        expectNoLogging();
        done();
      });
      fn(func, res);
    });
  });
});
