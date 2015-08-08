'use strict';

var _ = require('lodash'),
  filename = __filename.split('/').pop().split('.').shift(),
  lib = require('./' + filename),
  expect = require('chai').expect,
  sinon = require('sinon'),
  components = require('./services/components');

describe(_.startCase(filename), function () {
  var sandbox,
    basicHtml = '<html><head></head><body></body></html>',
    basicSection = '<section><header></header><footer></footer></section>',
    componentStyleHtml = '<html><head>\n<!-- Stylesheets Begin -->\n<link rel="stylesheet" type="text/css" href="/css/a.css" />\n<!-- Stylesheets End -->\n</head><body></body></html>',
    componentStyleSection = '<section>\n<!-- Stylesheets Begin -->\n<link rel="stylesheet" type="text/css" href="/css/a.css" />\n<!-- Stylesheets End -->\n<header></header><footer></footer></section>',
    componentScriptHtml = '<html><head></head><body>\n<!-- Scripts Begin -->\n<script type="text/javascript" src="/js/a.js"></script>\n<!-- Scripts End -->\n</body></html>',
    componentScriptSection = '<section><header></header><footer></footer>\n<!-- Scripts Begin -->\n<script type="text/javascript" src="/js/a.js"></script>\n<!-- Scripts End -->\n</section>';

  beforeEach(function () {
    sandbox = sinon.sandbox.create();
    sandbox.stub(components);
  });

  afterEach(function () {
    sandbox.restore();
  });

  describe('appendTop', function () {
    var fn = lib[this.title];

    it('adds nothing to bottom of head when no components', function () {
      components.getStyles.onCall(0).returns([]);

      expect(fn({components:[]})(basicHtml)).to.deep.equal(basicHtml);
    });

    it('adds nothing to top of root when no components', function () {
      components.getStyles.onCall(0).returns([]);

      expect(fn({components:[]})(basicSection)).to.deep.equal(basicSection);
    });

    it('adds to bottom of head', function () {
      components.getStyles.onCall(0).returns(['/css/a.css']);

      expect(fn({components:['a']})(basicHtml)).to.deep.equal(componentStyleHtml);
    });

    it('adds to top of root', function () {
      components.getStyles.onCall(0).returns(['/css/a.css']);

      expect(fn({components:['a']})(basicSection)).to.deep.equal(componentStyleSection);
    });
  });

  describe('appendBottom', function () {
    var fn = lib[this.title];

    it('adds nothing to bottom of body when no components', function () {
      components.getScripts.onCall(0).returns([]);

      expect(fn({components:[]})(basicHtml)).to.deep.equal(basicHtml);
    });

    it('adds nothing to bottom of root when no components', function () {
      components.getScripts.onCall(0).returns([]);

      expect(fn({components:[]})(basicSection)).to.deep.equal(basicSection);
    });

    it('adds to bottom of body', function () {
      components.getScripts.onCall(0).returns(['/js/a.js']);

      expect(fn({components:['a']})(basicHtml)).to.deep.equal(componentScriptHtml);
    });

    it('adds to bottom of root', function () {
      components.getScripts.onCall(0).returns(['/js/a.js']);

      expect(fn({components:['a']})(basicSection)).to.deep.equal(componentScriptSection);
    });
  });
});