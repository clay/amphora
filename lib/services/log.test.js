'use strict';
/* eslint max-nested-callbacks:[2,5] */

const sinon = require('sinon'),
  dirname = __dirname.split('/').pop(),
  filename = __filename.split('/').pop().split('.').shift(),
  lib = require('./' + filename),
  clayLog = require('clay-log');

describe(dirname, function () {
  describe(filename, function () {
    let sandbox, fakeLogger;

    beforeEach(function () {
      sandbox = sinon.sandbox.create();
      fakeLogger = sinon.stub();
      sandbox.stub(clayLog);
    });

    afterEach(function () {
      sandbox.restore();
    });

    describe('init', function () {
      const fn = lib[this.title];

      it('returns early if amphoraLogInstance is already defined', function () {
        lib.setLogger(fakeLogger);
        fn();
        sinon.assert.notCalled(clayLog.init);
      });

      it('calls the init function from clayLog', function () {
        lib.setLogger(undefined);
        fn();
        sinon.assert.calledOnce(clayLog.init);
      });
    });

    describe('setup', function () {
      const fn = lib[this.title];

      it('calls the clayLog meta function', function () {
        lib.setLogger(fakeLogger);
        fn();
        sinon.assert.calledOnce(clayLog.meta);
      });
    });
  });
});
