'use strict';

var _ = require('lodash'),
  filename = __filename.split('/').pop().split('.').shift(),
  lib = require('./' + filename),
  files = require('./files'),
  expect = require('chai').expect,
  sinon = require('sinon'),
  bluebird = require('bluebird'),
  log = require('./log');

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

    it('returns promise if import function available', function (done) {
      sandbox.stub(log);
      sandbox.mock(files).expects('getComponentModule').returns({
        import: function (ref, data) { return bluebird.resolve(data); }
      });

      fn('something', {}).then(function (result) {
        expect(result[0]).to.contain.keys('key', 'type', 'value');
        done();
      });
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
