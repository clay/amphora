'use strict';

var _ = require('lodash'),
  filename = __filename.split('/').pop().split('.').shift(),
  lib = require('./' + filename),
  components = require('./components'),
  sinon = require('sinon'),
  expect = require('chai').expect,
  db = require('../services/db'),
  bluebird = require('bluebird');

describe(_.startCase(filename), function () {
  var sandbox;

  beforeEach(function () {
    sandbox = sinon.sandbox.create();
    sandbox.stub(db);
    sandbox.stub(components);
  });

  afterEach(function () {
    sandbox.restore();
  });

  describe('create', function () {
    var fn = lib[this.title];

    it('creates', function () {
      components.get.returns(bluebird.resolve({}));
      db.batch.returns(bluebird.resolve());

      return fn('/pages', {layout: '/components/thing'}).then(function (result) {
        expect(result._ref).to.match(/^\/pages\//);
        delete result._ref;
        expect(result).to.deep.equal({layout: '/components/thing'});
      });
    });
  });

  describe('publish', function () {
    var fn = lib[this.title];

    it('publishes', function () {
      components.get.returns(bluebird.resolve({}));
      db.batch.returns(bluebird.resolve());

      return fn('/pages/thing', {layout: '/components/thing'}).then(function (result) {
        expect(result).to.deep.equal({ layout: '/components/thing@published' });
      });
    });
  });
});