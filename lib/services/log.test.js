'use strict';
/* eslint max-nested-callbacks:[2,5] */

const sinon = require('sinon'),
  dirname = __dirname.split('/').pop(),
  filename = __filename.split('/').pop().split('.').shift(),
  lib = require('./' + filename),
  clayLog = require('clay-log');

describe(dirname, function () {
  describe(filename, function () {
    let sandbox;

    beforeEach(function () {
      sandbox = sinon.sandbox.create();
      sandbox.stub(clayLog);
    });

    afterEach(function () {
      sandbox.restore();
    });

    describe('setup', function () {



    });
  });
});
