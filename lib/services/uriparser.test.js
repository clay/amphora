'use strict';

var _ = require('lodash'),
  UriParser = require('./uriparser'),
  expect = require('chai').expect;

describe('UriParser tests', function () {

  describe('get version', function () {
    it('returns published version when proper uri', function () {
      expect(new UriParser('localhost.example.com/prblog/components/valid/instances/Cascading@published').version()).to.be.equal('published')
    });

    it('returns draft version when proper uri', function () {
      expect(new UriParser('localhost.example.com/prblog/components/valid/instances/Cascading@dfds54fdsg4gsdfgs').version()).to.be.equal('dfds54fdsg4gsdfgs')
    });

    it('returns null when proper uri and no version', function () {
      expect(new UriParser('localhost.example.com/prblog/components/valid/instances/Cascading').version()).to.be.null
    });
  });

  describe('get component', function () {
    it('returns prefix when proper uri', function () {
      expect(new UriParser('localhost.example.com/prblog/components/valid/instances/Cascading@published').component()).to.be.equal('valid');
    });
    it('returns null when invalid uri format', function () {
      expect(new UriParser('localhost.example.com').component()).to.be.null;
    });
  });

  describe('get prefix', function () {
    it('returns prefix when proper uri', function () {
      expect(new UriParser('localhost.example.com/prblog/components/valid/instances/Cascading@published').prefix()).to.be.equal('prblog');
    });

    it('returns component and site when proper uri when full http url', function () {
      expect(new UriParser('http://localhost.example.com/prblog/components/valid/instances/Cascading@published').prefix()).to.be.equal('prblog');
    });

    it('returns component and no site when proper uri with no site name', function () {
      expect(new UriParser('localhost.example.com/components/valid/instances/Cascading@published').prefix()).to.be.null;
    });
  });
});
