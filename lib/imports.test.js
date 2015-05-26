'use strict';

var _ = require('lodash'),
  filename = __filename.split('/').pop().split('.').shift(),
  lib = require('./' + filename),
  files = require('./files'),
  expect = require('chai').expect,
  sinon = require('sinon');

describe(_.startCase(filename), function () {
  var sandbox;

  beforeEach(function () {
    sandbox = sinon.sandbox.create();
  });

  afterEach(function () {
    sandbox.restore();
  });

  describe('addComponent', function () {
    var fn = lib[this.title];

    it('missing parameters throws error', function () {
      expect(function () {
        fn('', {});
      }).to.throw();
    });

    it('returns data if no import function available', function () {
      sandbox.mock(files).expects('getComponentModule').returns(null);

      expect(fn('something', {})).to.contain.keys('key', 'type', 'value');
    });
  });

  describe('addPage', function () {
    var fn = lib[this.title];

    it('missing parameters throws error', function () {
      expect(function () {
        fn('', '', {}, {});
      }).to.throw();
    });
  });
});