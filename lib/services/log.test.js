'use strict';
/* eslint max-nested-callbacks:[2,5] */

const sinon = require('sinon'),
  dirname = __dirname.split('/').pop(),
  filename = __filename.split('/').pop().split('.').shift(),
  lib = require('./' + filename),
  winston = require('winston');

describe(dirname, function () {
  describe(filename, function () {
    let sandbox;

    beforeEach(function () {
      sandbox = sinon.sandbox.create();
      sandbox.stub(winston);
    });

    afterEach(function () {
      sandbox.restore();
    });

    describe('withStandardPrefix', function () {
      const fn = lib[this.title];

      it('with object', function () {
        const logFn = fn(__dirname);

        logFn('log', 'a', {b: 'c', d: {e: 'f'}});

        sinon.assert.calledOnce(winston.log);
      });

      it('with error', function () {
        const logFn = fn(__dirname);

        logFn('log', 'a', new Error('hello'));

        sinon.assert.calledOnce(winston.log);
      });

      it('with pseudo-error object', function () {
        const logFn = fn(__dirname);

        logFn('log', 'a', {
          stack: true,
          name: 'Foo Error'
        });

        sinon.assert.calledOnce(winston.log);
      });

      it('with string', function () {
        const logFn = fn(__dirname);

        logFn('log', 'a', 'b');

        sinon.assert.calledOnce(winston.log);
      });

      it('logs to elk if CLAY_ENV set', function () {
        const logFn = fn(__dirname);

        lib.addELK('domain.com:1010');

        logFn('log', 'a', {b: 'c', d: {e: 'f'}});

        sinon.assert.calledOnce(winston.log);
      });
    });

    describe('addELK', function functionName() {
      const fn = lib[this.title];

      it('does not call winston.add if Logstash is already defined', function () {
        winston.transports.Logstash = true;
        fn('domain.com:1010');

        sinon.assert.notCalled(winston.add);
      });
    });

  });
});
