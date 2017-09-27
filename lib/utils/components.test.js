'use strict';
/* eslint max-nested-callbacks:[2,5] */

var _ = require('lodash'),
  sinon = require('sinon'),
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

    it('finds /_components/name', function () {
      expect(fn('/_components/name')).to.equal('name');
    });

    it('finds /_components/name/', function () {
      expect(fn('/_components/name/')).to.equal('name');
    });

    it('finds /_components/name/instances/id', function () {
      expect(fn('/_components/name/instances/id')).to.equal('name');
    });

    it('finds /_components/name.ext', function () {
      expect(fn('/_components/name.ext')).to.equal('name');
    });

    it('finds /_components/name@version', function () {
      expect(fn('/_components/name@version')).to.equal('name');
    });

    it('finds domain.com/path/_components/name', function () {
      expect(fn('domain.com/path/_components/name')).to.equal('name');
    });

    it('finds domain.com/path/_components/name/', function () {
      expect(fn('domain.com/path/_components/name/')).to.equal('name');
    });

    it('finds domain.com/path/_components/name/instances/id', function () {
      expect(fn('domain.com/path/_components/name/instances/id')).to.equal('name');
    });

    it('finds domain.com/path/_components/name.ext', function () {
      expect(fn('domain.com/path/_components/name.ext')).to.equal('name');
    });

    it('finds domain.com/path/_components/name@version', function () {
      expect(fn('domain.com/path/_components/name@version')).to.equal('name');
    });
  });

});
