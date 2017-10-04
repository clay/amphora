'use strict';
/* eslint max-nested-callbacks:[2,5] */

const sinon = require('sinon'),
  dirname = __dirname.split('/').pop(),
  filename = __filename.split('/').pop().split('.').shift(),
  lib = require('./' + filename),
  clayLog = require('clay-log');

describe(dirname, function () {
  describe(filename, function () {
    let sandbox, fakeLog;

    beforeEach(function () {
      sandbox = sinon.sandbox.create();
      fakeLog = sandbox.stub();
      sinon.stub(clayLog);
    });

    afterEach(function () {
      sandbox.restore();
    });

    describe('init', function () {
      const fn = lib[this.title];

      it('returns if a log instance is set', function () {
        lib.setLogger(fakeLog);
        fn();
        sinon.assert.notCalled(clayLog.init);
      });
    });
  });
});
