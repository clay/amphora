'use strict';

var _ = require('lodash'),
  filename = _.startCase(__filename.split('/').pop().split('.').shift()),
  lib = require('./' + filename),
  db = require('./db'),
  expect = require('chai').expect,
  sinon = require('sinon'),
  bluebird = require('bluebird'),
  log = require('./log');



describe(filename, function () {
  var sandbox;

  /**
   * Create fake response object.
   * @param options
   * @returns {{}}
   */
  function createMockRes(options) {
    options = options || {};
    var res = {};
    res.status = _.constant(res);
    res.send = _.constant(res);
    res.json = _.constant(res);
    res.locals = {site: 'someSite'};
    res.sendStatus = function (code) {
      res.status(code);
      res.send('sendStatus: whatever');
    };
    res.format = function (formatters) {
      formatters[options.formatter || 'default']();
      return res;
    };
    return res;
  }

  /**
   * Shortcut
   * @param res
   * @param code
   */
  function expectStatus(res, code) {
    sandbox.mock(res).expects('status').withArgs(code).returns(res);
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


});