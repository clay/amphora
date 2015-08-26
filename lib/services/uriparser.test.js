'use strict';

var filename = __filename.split('/').pop().split('.').shift(),
  Lib = require('./' + filename),
  expect = require('chai').expect;


describe('UriParser tests', function () {

  function fn(uri, title) {
    return new Lib(uri)[title]();
  }

  describe('version', function () {
    const title = this.title;

    it('returns published version when proper uri', function () {
      expect(fn('localhost.example.com/prblog/components/valid/instances/Cascading@published', title)).to.be.equal('published');
    });

    it('returns draft version when proper uri', function () {
      expect(fn('localhost.example.com/prblog/components/valid/instances/Cascading@dfds54fdsg4gsdfgs', title)).to.be.equal('dfds54fdsg4gsdfgs');
    });

    it('returns null when proper uri and no version', function () {
      expect(fn('localhost.example.com/prblog/components/valid/instances/Cascading', title)).to.be.an('null');
    });
  });

  describe('component', function () {
    const title = this.title;

    it('returns prefix when proper uri', function () {
      expect(fn('localhost.example.com/prblog/components/valid/instances/Cascading@published', title)).to.be.equal('valid');
    });
    it('returns null when invalid uri format', function () {
      expect(fn('localhost.example.com', title)).to.be.an('null');
    });
  });

  describe('prefix', function () {
    const title = this.title;

    it('returns prefix when proper uri', function () {
      expect(fn('localhost.example.com/prblog/components/valid/instances/Cascading@published', title)).to.be.equal('prblog');
    });

    it('returns component and site when proper uri when full http url', function () {
      expect(fn('http://localhost.example.com/prblog/components/valid/instances/Cascading@published', title)).to.be.equal('prblog');
    });

    it('returns component and no site when proper uri with no site name', function () {
      expect(fn('localhost.example.com/components/valid/instances/Cascading@published', title)).to.be.an('null');
    });
  });
});
