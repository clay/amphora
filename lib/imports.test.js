'use strict';

var _ = require('lodash'),
  filename = __filename.split('/').pop().split('.').shift(),
  lib = require('./' + filename),
  db = require('./services/db'),
  expect = require('chai').expect,
  sinon = require('sinon'),
  bluebird = require('bluebird'),
  log = require('./log'),
  filter = require('through2-filter');

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