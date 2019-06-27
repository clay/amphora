'use strict';

const _ = require('lodash'),
  filename = __filename.split('/').pop().split('.').shift(),
  lib = require('./' + filename),
  expect = require('chai').expect,
  sinon = require('sinon'),
  bluebird = require('bluebird'),
  filter = require('through2-filter'),
  createMockReq = require('../test/fixtures/mocks/req'),
  createMockRes = require('../test/fixtures/mocks/res'),
  storage = require('../test/fixtures/mocks/storage');

describe(_.startCase(filename), function () {
  let sandbox, fakeLog, db;

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
   * Shortcut
   *
   * @param {object} res
   * @param {object} expected
   * @param {Function} done
   */
  function expectResult(res, expected, done) {
    sandbox.stub(res, 'send').callsFake(function (result) {
      sandbox.verify();
      expect(result).to.deep.equal(expected);
      done();
    });
  }

  beforeEach(function () {
    sandbox = sinon.sandbox.create();
    fakeLog = sandbox.stub();
    lib.setLog(fakeLog);
    db = storage();
    lib.setDb(db);
  });

  afterEach(function () {
    sandbox.restore();
  });

  after(function () {
    return db.clearMem();
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

    it('sends the error code defined in the `status` property', function (done) {
      const res = createMockRes(),
        myError = new Error('something');

      myError.status = 403;
      expectStatus(res, 403);
      expectResult(res, 'sendStatus: whatever', done);
      fn(res)(myError);
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
        sinon.assert.calledWith(fakeLog, 'error');
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
      return db.clearMem().then(function () {
        return bluebird.join(
          db.writeToInMem('base.com/a', 'b'),
          db.writeToInMem('base.com/aa', 'b'),
          db.writeToInMem('base.com/aaa', 'b'),
          db.writeToInMem('base.com/c', 'd'),
          db.writeToInMem('base.com/cc', 'd'),
          db.writeToInMem('base.com/ccc', 'd'),
          db.writeToInMem('base.com/e', 'f')
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

  describe('checkArchivedToPublish', function () {
    const fn = lib[this.title];

    it('throws an error if checkProps returns true', function () {
      const req = {
          body: { archived: true },
          uri: 'domain.com/_pages/id'
        },
        res = createMockRes();

      db.getMeta.returns(Promise.resolve({ published: true }));

      expectStatus(res, 400);
      fn(req, res);
    });

    it('calls next if checkProps returns false', function () {
      let req = {
        body: {archived: true},
        uri: 'domain.com/_pages/id'
      };
      const res = createMockRes(),
        next = sinon.stub();

      db.getMeta.returns(Promise.resolve({ published: false }));

      fn(req, res, next)
        .then(()=> sinon.assert.calledOnce(next));
    });
  });
});
