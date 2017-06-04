'use strict';

const _ = require('lodash'),
  filename = __filename.split('/').pop().split('.').shift(),
  lib = require('./' + filename),
  db = require('./services/db'),
  expect = require('chai').expect,
  sinon = require('sinon'),
  bluebird = require('bluebird'),
  winston = require('winston'),
  filter = require('through2-filter'),
  createMockReq = require('../test/fixtures/mocks/req'),
  createMockRes = require('../test/fixtures/mocks/res');

describe(_.startCase(filename), function () {
  let sandbox;

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
    sinon.assert.notCalled(winston.log);
    sinon.assert.notCalled(winston.info);
    sinon.assert.notCalled(winston.warn);
    sinon.assert.notCalled(winston.error);
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
    sandbox.stub(winston);
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
        sinon.assert.calledWith(winston.log, 'error');
        done();
      });
      fn(res)(new Error('something'));
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
        sinon.assert.calledWith(winston.log, 'error');
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
        sinon.assert.calledWith(winston.log, 'error');
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

  describe('onlyAcceptExtensions', function (done) {
    const fn = lib[this.title];

    it('throws when not given extensions', function () {
      expect(function () {
        fn({});
      }).to.throw('Missing extensions option');
    });

    it('throws when no extensions', function () {
      const req = createMockReq(),
        res = createMockRes({formatter: 'json'}),
        routeFn = fn({extensions: {a: 'b'}});

      expect(function () {
        routeFn(req, res, done);
      }).to.throw('Missing required extension parameter');
    });

    it('blocks when client does not accept data', function (done) {
      const req = createMockReq(),
        res = createMockRes({formatter: 'json'}),
        routeFn = fn({extensions: {a: 'b'}});

      req.params = {ext: 'a'};
      expectStatus(res, 404);
      routeFn(req, res, done);
    });

    it('blocks when client passes unknown extension with 404', function (done) {
      const req = createMockReq(),
        res = createMockRes({formatter: 'json'}),
        routeFn = fn({extensions: {a: 'b'}});

      req.params = {ext: 'c'};
      expectStatus(res, 404);
      res.send = function (result) {
        expect(result).to.deep.equal({ message: 'Not Found', code: 404 });
        done();
      };
      routeFn(req, res);
    });

    it('blocks when client passes known extension with unknown accepts header', function (done) {
      const req = createMockReq(),
        res = createMockRes({formatter: 'json'}),
        routeFn = fn({extensions: {a: 'b'}});

      req.params = {ext: 'a'};
      req.headers.accepts = 'c';
      expectStatus(res, 406);
      routeFn(req, res, done);
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
          db.put('base.com/a', 'b'),
          db.put('base.com/aa', 'b'),
          db.put('base.com/aaa', 'b'),
          db.put('base.com/c', 'd'),
          db.put('base.com/cc', 'd'),
          db.put('base.com/ccc', 'd'),
          db.put('base.com/e', 'f')
        );
      });
    });

    it('uses uri as prefix if no options given', function (done) {
      const req = createMockReq(),
        res = createMockRes();

      req.hostname = 'base.com';
      req.path = '/a';

      expectResult(res, '["base.com/aa","base.com/aaa"]', function () {
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

      expectResult(res, '["base.com/cc","base.com/ccc"]', done);
      fn({prefix: 'base.com/c'})(req, res);
    });

    it('can filter results if given appropriate transform', function (done) {
      const req = createMockReq(),
        res = createMockRes(),
        onlyCFilter = filter({wantStrings: true}, function (str) { return str.indexOf('/c') !== -1; });

      req.hostname = 'base.com';
      req.path = '/';

      expectResult(res, '["base.com/c","base.com/cc","base.com/ccc"]', function () {
        expectNoLogging();
        done();
      });
      fn({transforms: [onlyCFilter]})(req, res);
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
