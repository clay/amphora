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

      return fn('domain.com/path/pages', {layout: 'domain.com/path/components/thing'}).then(function (result) {
        expect(result._ref).to.match(/^\/pages\//);
        delete result._ref;
        expect(result).to.deep.equal({layout: 'domain.com/path/components/thing'});
      });
    });
  });

  describe('publish', function () {
    var fn = lib[this.title];

    it('publishes', function () {
      components.get.returns(bluebird.resolve({}));
      db.batch.returns(bluebird.resolve());

      return fn('domain.com/path/pages/thing', {layout: 'domain.com/path/components/thing'}).then(function (result) {
        expect(result).to.deep.equal({ layout: 'domain.com/path/components/thing@published' });
      });
    });
  });

  describe('replacePageReferenceVersions', function () {
    var fn = lib[this.title];

    it('adds version', function () {
      expect(fn({a: 'b'}, 'c')).to.deep.equal({ a: 'b@c' });
    });

    it('removes version', function () {
      expect(fn({a: 'b@c'})).to.deep.equal({ a: 'b' });
    });

    it('adds version in array', function () {
      expect(fn({a: ['b']}, 'c')).to.deep.equal({ a: ['b@c'] });
    });

    it('removes version in array', function () {
      expect(fn({a: ['b@c']})).to.deep.equal({ a: ['b'] });
    });

    it('ignores object type', function () {
      expect(fn({a: {b: 'bad data'}}, 'c')).to.deep.equal({ a: { b: 'bad data' } });
    });

    it('ignores boolean type', function () {
      expect(fn({a: true})).to.deep.equal({a: true});
    });
  });
});