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

    });
  });
});
