'use strict';
var expect = require('chai').expect,
  sinon = require('sinon'),
  glob = require('glob'),
  config = require('config'),
  composer = require('./composer');

describe('Composer', function () {
  describe('getTemplate()', function () {
    var sandbox;

    beforeEach(function () {
      sandbox = sinon.sandbox.create();
      sandbox.stub(config, 'get').returns('template');
    });

    afterEach(function () {
      sandbox.restore();
    });

    it('throws error if no templates found', function () {
      sandbox.stub(glob, 'sync').returns([]);
      expect(function () {
        return composer.getTemplate();
      }).to.throw(Error);
    });

    it('gets a nunjucks template', function () {
      sandbox.stub(glob, 'sync').returns(['template.nunjucks']);
      expect(composer.getTemplate()).to.eql('template.nunjucks');
    });

    it('gets a jade template', function () {
      sandbox.stub(glob, 'sync').returns(['template.jade']);
      expect(composer.getTemplate()).to.eql('template.jade');
    });

    it('gets a mustache template', function () {
      sandbox.stub(glob, 'sync').returns(['template.mustache']);
      expect(composer.getTemplate()).to.eql('template.mustache');
    });
  });
});