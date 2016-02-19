'use strict';

const _ = require('lodash'),
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
    return {
      media: obj
    };
  }

  describe('append', function () {
    const fn = lib[this.title];

    it('does not throw when missing mediaMap', function () {
      components.getStyles.onCall(0).returns([]);

      expect(function () {
        fn({})(basicHtml);
      }).to.not.throw();
    });

    it('throws when missing html', function () {
      components.getStyles.onCall(0).returns([]);

      expect(function () {
        fn(mediaMap({scripts:[], styles: []}))();
      }).to.throw('Missing html parameter');
    });

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
    const fn = lib[this.title];

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

  describe('addMediaMap', function () {
    const fn = lib[this.title];

    it('throws if missing locals.site.slug', function () {
      var componentList = [],
        data = {},
        locals = {site: {}};

      expect(function () {
        fn(componentList, data, locals);
      }).to.throw(TypeError);
    });

    it('does not set media if missing components', function () {
      var componentList = [],
        data = {},
        locals = {site: {slug: 'hey'}};

      fn(componentList, data, locals);

      expect(data.media).to.equal(undefined);
    });

    it('sets media if components have styles and scripts', function () {
      var siteName = 'some site',
        componentList = ['a', 'e'],
        data = {},
        locals = {site: {slug: siteName}};

      components.getScripts.withArgs('a', siteName).returns(['/c/d']);
      components.getStyles.withArgs('e', siteName).returns(['/f/g']);

      fn(componentList, data, locals);

      expect(data.media).to.deep.equal({
        styles: ['/f/g'],
        scripts: ['/c/d']
      });
    });

    it('allows user to set own media', function () {
      var siteName = 'some site',
        componentList = ['a', 'e'],
        data = {},
        locals = {site: {
          slug: siteName,
          resolveMedia: function () {
            return {
              scripts: ['/f/g'],
              styles: ['/c/d']
            };
          }
        }};

      components.getScripts.withArgs('a', siteName).returns(['/h/i']);
      components.getStyles.withArgs('e', siteName).returns(['/j/k']);

      fn(componentList, data, locals);

      expect(data.media).to.deep.equal({
        scripts: ['/f/g'],
        styles: ['/c/d']
      });
    });

    it('allows user to set own media by editing arrays in-place', function () {
      var siteName = 'some site',
        componentList = ['a', 'e'],
        data = {},
        locals = {site: {
          slug: siteName,
          resolveMedia: function (media) {
            media.scripts.push('/x/y');
          }
        }};

      components.getScripts.withArgs('a', siteName).returns(['/h/i']);
      components.getStyles.withArgs('e', siteName).returns(['/j/k']);

      fn(componentList, data, locals);

      expect(data.media).to.deep.equal({
        styles: ['/j/k'],
        scripts: ['/h/i', '/x/y']
      });
    });
  });
});