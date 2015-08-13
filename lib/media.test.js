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
    componentStyleHtml = '<html><head>\n<!-- Stylesheets Begin -->\n<link rel="stylesheet" type="text/css" href="a" />\n<!-- Stylesheets End -->\n</head><body></body></html>',
    componentStyleSection = '<section>\n<!-- Stylesheets Begin -->\n<link rel="stylesheet" type="text/css" href="a" />\n<!-- Stylesheets End -->\n<header></header><footer></footer></section>',
    componentScriptHtml = '<html><head></head><body>\n<!-- Scripts Begin -->\n<script type="text/javascript" src="a"></script>\n<!-- Scripts End -->\n</body></html>',
    componentScriptSection = '<section><header></header><footer></footer>\n<!-- Scripts Begin -->\n<script type="text/javascript" src="a"></script>\n<!-- Scripts End -->\n</section>';

  beforeEach(function () {
    sandbox = sinon.sandbox.create();
    sandbox.stub(components);
  });

  afterEach(function () {
    sandbox.restore();
  });

  /**
   * Wrap as mediaMap
   * @param obj
   * @returns {{}}
   */
  function mediaMap(obj) {
    var container = {};

    container[lib.mediaMapProperty] = obj;

    return container;
  }

  describe('append', function () {
    var fn = lib[this.title];

    it('adds nothing to bottom of head when no styles', function () {
      components.getStyles.onCall(0).returns([]);

      expect(fn(mediaMap({scripts:[], styles: []}))(basicHtml)).to.deep.equal(basicHtml);
    });

    it('adds nothing to top of root when no components', function () {
      components.getStyles.onCall(0).returns([]);

      expect(fn(mediaMap({scripts:[], styles: []}))(basicSection)).to.deep.equal(basicSection);
    });

    it('adds to bottom of head', function () {
      components.getStyles.onCall(0).returns(['/css/a.css']);

      expect(fn(mediaMap({scripts:[], styles: ['a']}))(basicHtml)).to.deep.equal(componentStyleHtml);
    });

    it('adds to top of root', function () {
      components.getStyles.onCall(0).returns(['/css/a.css']);

      expect(fn(mediaMap({scripts:[], styles: ['a']}))(basicSection)).to.deep.equal(componentStyleSection);
    });

    it('adds nothing to bottom of body when no components', function () {
      components.getScripts.onCall(0).returns([]);

      expect(fn(mediaMap({scripts:[], styles: []}))(basicHtml)).to.deep.equal(basicHtml);
    });

    it('adds nothing to bottom of root when no components', function () {
      components.getScripts.onCall(0).returns([]);

      expect(fn(mediaMap({scripts:[], styles: []}))(basicSection)).to.deep.equal(basicSection);
    });

    it('adds to bottom of body', function () {
      components.getScripts.onCall(0).returns(['/js/a.js']);

      expect(fn(mediaMap({scripts:['a'], styles: []}))(basicHtml)).to.deep.equal(componentScriptHtml);
    });

    it('adds to bottom of root', function () {
      components.getScripts.onCall(0).returns(['/js/a.js']);

      expect(fn(mediaMap({scripts:['a'], styles: []}))(basicSection)).to.deep.equal(componentScriptSection);
    });
  });

  describe('getMediaMap', function () {
    var fn = lib[this.title];

    it('accepts empty list, empty slug', function () {
      expect(fn([])).to.deep.equal({scripts: [], styles: []});
    });

    it('accepts list, empty slug (non-existent components)', function () {
      expect(fn(['a', 'b', 'c'])).to.deep.equal({scripts: [], styles: []});
    });

    it('accepts list and slug (non-existent components)', function () {
      expect(fn(['a', 'b', 'c'], 'd')).to.deep.equal({scripts: [], styles: []});
    });

    it('accepts list, empty slug (has scripts)', function () {
      components.getScripts.withArgs('a', undefined).returns(['/e/a']);
      components.getScripts.withArgs('b', 'd').returns(['/e/b']);
      components.getScripts.withArgs('c', undefined).returns(['/e/c', '/e/cc']);

      expect(fn(['a', 'b', 'c'])).to.deep.equal({scripts: ['/e/a', '/e/c', '/e/cc'], styles: []});
    });

    it('accepts list and slug (has scripts)', function () {
      components.getScripts.withArgs('a', undefined).returns(['/e/a']);
      components.getScripts.withArgs('a', 'd').returns(['/e/aa']);
      components.getScripts.withArgs('b', 'd').returns(['/e/b', '/e/bb']);
      components.getScripts.withArgs('c', undefined).returns(['/e/c', '/e/cc']);

      expect(fn(['a', 'b', 'c'], 'd')).to.deep.equal({scripts: ['/e/aa', '/e/b', '/e/bb'], styles: []});
    });

    it('accepts list, empty slug (has styles)', function () {
      components.getStyles.withArgs('a', undefined).returns(['/e/a']);
      components.getStyles.withArgs('b', 'd').returns(['/e/b']);
      components.getStyles.withArgs('c', undefined).returns(['/e/c', '/e/cc']);

      expect(fn(['a', 'b', 'c'])).to.deep.equal({scripts: [], styles: ['/e/a', '/e/c', '/e/cc']});
    });

    it('accepts list and slug (has styles)', function () {
      components.getStyles.withArgs('a', undefined).returns(['/e/a']);
      components.getStyles.withArgs('a', 'd').returns(['/e/aa']);
      components.getStyles.withArgs('b', 'd').returns(['/e/b', '/e/bb']);
      components.getStyles.withArgs('c', undefined).returns(['/e/c', '/e/cc']);

      expect(fn(['a', 'b', 'c'], 'd')).to.deep.equal({scripts: [], styles: ['/e/aa', '/e/b', '/e/bb']});
    });
  });
});