'use strict';

var _ = require('lodash'),
  filename = __filename.split('/').pop().split('.').shift(),
  lib = require('./' + filename),
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

  describe('replaceVersion', function () {
    var fn = lib[this.title];

    it('replaces version with new version', function () {
      expect(fn('a@b', 'c')).to.equal('a@c');
    });

    it('replaces version with no version', function () {
      expect(fn('a@b')).to.equal('a');
    });

    it('replaces no version with version', function () {
      expect(fn('a', 'c')).to.equal('a@c');
    });
  });

  describe('replaceAllVersions', function () {
    var fn = lib[this.title];

    it('replaces all versions with new version', function () {
      expect(fn('c')({_ref: 'x@x', deep: {_ref: 'a@b', thing: {_ref: 'a'}}})).to.deep.equal({_ref: 'x@x', deep: {_ref: 'a@c', thing: {_ref: 'a@c'}}});
    });

    it('replaces all versions with no version', function () {
      expect(fn()({_ref: 'x@x', deep: {_ref: 'a@b', thing: {_ref: 'a'}}})).to.deep.equal({_ref: 'x@x', deep: {_ref: 'a', thing: {_ref: 'a'}}});
    });
  });

  describe('setPropagatingVersions', function () {
    var fn = lib[this.title];

    it('sets', function () {
      expect(function () { fn([]); }).to.not.throw();
    });
  });

  describe('get version', function () {
    it('returns published version when proper uri', function () {
      expect(new lib.UriParser('localhost.example.com/prblog/components/valid/instances/Cascading@published').version()).to.be.equal('published')
    });

    it('returns draft version when proper uri', function () {
      expect(new lib.UriParser('localhost.example.com/prblog/components/valid/instances/Cascading@dfds54fdsg4gsdfgs').version()).to.be.equal('dfds54fdsg4gsdfgs')
    });

    it('returns null when proper uri and no version', function () {
      expect(new lib.UriParser('localhost.example.com/prblog/components/valid/instances/Cascading').version()).to.be.null
    });
  });

  describe('get component', function () {
    it('returns prefix when proper uri', function () {
      expect(new lib.UriParser('localhost.example.com/prblog/components/valid/instances/Cascading@published').component()).to.be.equal('valid');
    });
    it('returns null when invalid uri format', function () {
      expect(new lib.UriParser('localhost.example.com').component()).to.be.null;
    });
  });

  describe('get prefix', function () {
    it('returns prefix when proper uri', function () {
      expect(new lib.UriParser('localhost.example.com/prblog/components/valid/instances/Cascading@published').prefix()).to.be.equal('prblog');
    });

    it('returns component and site when proper uri when full http url', function () {
      expect(new lib.UriParser('http://localhost.example.com/prblog/components/valid/instances/Cascading@published').prefix()).to.be.equal('prblog');
    });

    it('returns component and no site when proper uri with no site name', function () {
      expect(new lib.UriParser('localhost.example.com/components/valid/instances/Cascading@published').prefix()).to.be.null;
    });
  });
});
