'use strict';
/* eslint max-nested-callbacks:[2,5] */

var _ = require('lodash'),
  promise = require('bluebird'),
  files = require('../files'),
  schema = require('../schema'),
  expect = require('chai').expect,
  filename = __filename.split('/').pop().split('.').shift(),
  lib = require('./' + filename);

describe(_.startCase(filename), function () {
  let sandbox;

  beforeEach(function () {
    sandbox = sinon.sandbox.create();
  });

  afterEach(function () {
    sandbox.restore();
  });

  describe('getName', function () {
    const fn = lib[this.title];

    it('finds /components/name', function () {
      expect(fn('/components/name')).to.equal('name');
    });

    it('finds /components/name/', function () {
      expect(fn('/components/name/')).to.equal('name');
    });

    it('finds /components/name/instances/id', function () {
      expect(fn('/components/name/instances/id')).to.equal('name');
    });

    it('finds /components/name.ext', function () {
      expect(fn('/components/name.ext')).to.equal('name');
    });

    it('finds /components/name@version', function () {
      expect(fn('/components/name@version')).to.equal('name');
    });

    it('finds domain.com/path/components/name', function () {
      expect(fn('domain.com/path/components/name')).to.equal('name');
    });

    it('finds domain.com/path/components/name/', function () {
      expect(fn('domain.com/path/components/name/')).to.equal('name');
    });

    it('finds domain.com/path/components/name/instances/id', function () {
      expect(fn('domain.com/path/components/name/instances/id')).to.equal('name');
    });

    it('finds domain.com/path/components/name.ext', function () {
      expect(fn('domain.com/path/components/name.ext')).to.equal('name');
    });

    it('finds domain.com/path/components/name@version', function () {
      expect(fn('domain.com/path/components/name@version')).to.equal('name');
    });
  });

});
