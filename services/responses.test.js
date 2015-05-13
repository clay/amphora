'use strict';

var _ = require('lodash'),
  filename = _.startCase(__filename.split('/').pop().split('.').shift()),
  lib = require('./' + filename),
  db = require('./db'),
  expect = require('chai').expect,
  sinon = require('sinon'),
  bluebird = require('bluebird'),
  log = require('./log'),
  filter = require('through2-filter'),
  createMockReq = require('../test/fixtures/mocks/req'),
  createMockRes = require('../test/fixtures/mocks/res');

describe(filename, function () {
  var sandbox;

  /**
   * Shortcut
   * @param res
   * @param code
   */
  function expectStatus(res, code) {
    sandbox.mock(res).expects('status').withArgs(code).returns(res).atLeast(1);
  }

  /**
   * Shortcut
   */
  function expectNoLogging() {
    var logExpectations = sandbox.mock(log);
    logExpectations.expects('info').never();
    logExpectations.expects('warn').never();
    logExpectations.expects('error').never();
  }

  beforeEach(function () {
    sandbox = sinon.sandbox.create();
  });

  afterEach(function () {
    sandbox.restore();
  });

  describe('removeQueryString', function () {
    var fn = lib[this.title];

    it('basic case', function () {
      expect(fn('something?something')).to.equal('something');
    });
  });

  describe('removeExtension', function () {
    var fn = lib[this.title];

    it('basic case', function () {
      expect(fn('something.something')).to.equal('something');
    });
  });

  describe('notImplemented', function () {
    var fn = lib[this.title];

    it('sends 501', function (done) {
      var res = createMockRes();

      expectNoLogging();
      expectStatus(res, 501);
      sandbox.stub(res, 'send', function () {
        done();
      });

      fn({}, res);
    });
  });

  describe('expectJSON', function () {
    var fn = lib[this.title];

    it('sends json', function (done) {
      var data = {},
        res = createMockRes({formatter: 'json'});

      expectNoLogging();
      sandbox.stub(res, 'json', function (result) {
        sandbox.verify();
        expect(result).to.equal(data);
        done();
      });

      fn(function () {
        return data;
      }, res);
    });

    it('404 on Error "not found"', function (done) {
      var res = createMockRes({formatter: 'json'});

      expectNoLogging();
      expectStatus(res, 404);
      sandbox.stub(res, 'send', function (result) {
        sandbox.verify();
        expect(result).to.deep.equal({
          message: 'Not Found',
          code: 404
        });
        done();
      });

      fn(function () {
        throw Error('something not found: etc etc');
      }, res);
    });
  });

  describe('expectHTML', function () {
    var fn = lib[this.title];

    it('sends html', function (done) {
      var data = 'some html',
        res = createMockRes({formatter: 'html'});

      expectNoLogging();
      sandbox.stub(res, 'send', function (result) {
        sandbox.verify();
        expect(result).to.equal(data);
        done();
      });

      fn(function () {
        return data;
      }, res);
    });

    it('404 on Error "not found"', function (done) {
      var res = createMockRes({formatter: 'html'});

      expectNoLogging();
      expectStatus(res, 404);
      sandbox.stub(res, 'send', function () {
        sandbox.verify();
        done();
      });

      fn(function () {
        throw Error('something not found: etc etc');
      }, res);
    });
  });

  describe('list', function () {
    var fn = lib[this.title];

    beforeEach(function () {
      return db.clear().then(function () {
        return bluebird.join(
          db.put('a', 'b'),
          db.put('aa', 'b'),
          db.put('aaa', 'b'),
          db.put('c', 'd'),
          db.put('cc', 'd'),
          db.put('ccc', 'd'),
          db.put('e', 'f')
        );
      });
    });

    it('uses url as prefix if no options given', function (done) {
      var req = createMockReq(),
        res = createMockRes();

      req.url = 'a';
      res.send = function (result) {
        expect(result).to.equal('["aa","aaa"]');
        done();
      };
      fn()(req, res);
    });

    it('should use prefix in options if given', function (done) {
      var req = createMockReq(),
        res = createMockRes();

      req.url = 'a';
      res.send = function (result) {
        expect(result).to.equal('["cc","ccc"]');
        done();
      };
      fn({prefix: 'c'})(req, res);
    });

    it('can filter results', function (done) {
      var req = createMockReq(),
        res = createMockRes();

      req.url = '';
      res.send = function (result) {
        expect(result).to.equal('["c","cc","ccc"]');
        done();
      };
      fn({filters: [filter({wantStrings: true}, function (str) {
        return str.indexOf('c') !== -1;
      })]})(req, res);
    });
  });
});