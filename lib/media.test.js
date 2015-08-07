'use strict';

var _ = require('lodash'),
  filename = __filename.split('/').pop().split('.').shift(),
  lib = require('./' + filename),
  expect = require('chai').expect,
  sinon = require('sinon'),
  files = require('./files');

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
    sandbox.stub(files);

  });

  afterEach(function () {
    sandbox.restore();
  });

  describe('appendTop', function () {
    var fn = lib[this.title];

    it('adds nothing to bottom of head when no components', function () {
      var result,
        data = basicHtml;

      result = fn({components:[]})(data);

      expect(result).to.deep.equal(data);
    });

    it('adds nothing to top of root when no components', function () {
      var result,
        data = basicSection;

      result = fn({components:[]})(data);

      expect(result).to.deep.equal(data);
    });

    it('adds to bottom of head', function () {
      var result,
        data = basicHtml,
        expectedResult = componentStyleHtml;

      files.safeFileExists.onCall(0).returns(true);

      result = fn({components:['a']})(data);

      expect(result).to.deep.equal(expectedResult);
    });

    it('adds to top of root', function () {
      var result,
        data = basicSection,
        expectedResult = componentStyleSection;

      files.safeFileExists.onCall(0).returns(true);

      result = fn({components:['a']})(data);

      expect(result).to.deep.equal(expectedResult);
    });
  });

  describe('appendBottom', function () {
    var fn = lib[this.title];

    it('adds nothing to bottom of body when no components', function () {
      expect(fn({components:[]})(basicHtml)).to.deep.equal(basicHtml);
    });

    it('adds nothing to bottom of root when no components', function () {
      expect(fn({components:[]})(basicSection)).to.deep.equal(basicSection);
    });

    it('adds to bottom of body', function () {
      files.safeFileExists.onCall(0).returns(true);

      expect(fn({components:['a']})(basicHtml)).to.deep.equal(componentScriptHtml);
    });

    it('adds to bottom of root', function () {
      files.safeFileExists.onCall(0).returns(true);

      expect(fn({components:['a']})(basicSection)).to.deep.equal(componentScriptSection);
    });
  });
});