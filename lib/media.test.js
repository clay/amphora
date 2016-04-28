'use strict';

const _ = require('lodash'),
  filename = __filename.split('/').pop().split('.').shift(),
  lib = require('./' + filename),
  expect = require('chai').expect,
  sinon = require('sinon'),
  components = require('./services/components'),
  files = require('./files');

describe(_.startCase(filename), function () {
  let sandbox,
    basicHtml = '<html><head></head><body></body></html>',
    basicSection = '<section><header></header><footer></footer></section>',
    styleString = '.test { color: red; }',
    scriptString = 'console.log("Tests!");',
    componentStyleHtml = '<html><head><style>' + styleString + '</style></head><body></body></html>',
    componentScriptHtml = '<html><head></head><body><script type="text/javascript">' + scriptString + '</script></body></html>',
    componentStyleSection = '<section><style>' + styleString + '</style><header></header><footer></footer></section>',
    componentScriptSection = '<section><header></header><footer></footer><script type="text/javascript">' + scriptString + '</script></section>';

  beforeEach(function () {
    sandbox = sinon.sandbox.create();
    sandbox.stub(components);
    sandbox.stub(files);
  });

  afterEach(function () {
    sandbox.restore();
  });

  /**
   * Wrap as mediaMap
   * @param {object} obj
   * @returns {object}
   */
  function mediaMap(obj) {
    return {
      media: obj
    };
  }

  describe('append', function () {
    const fn = lib[this.title],
      locals = {
        site: {
          assetPath: '/sitename',
          assetDir: '/public'
        }
      };

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

      fn(mediaMap({scripts:[], styles: []}), locals)(basicHtml).then(function (html) {
        expect(html).to.deep.equal(basicHtml);
      });
    });

    it('adds nothing to top of root when no components', function () {
      components.getStyles.onCall(0).returns([]);

      fn(mediaMap({scripts:[], styles: []}), locals)(basicSection)
        .then(function (html) {
          expect(html).to.deep.equal(basicSection);
        });
    });

    it('adds nothing to bottom of root when no components', function () {
      components.getScripts.onCall(0).returns([]);

      fn(mediaMap({scripts:[], styles: []}), locals)(basicHtml)
        .then(function (html) {
          expect(html).to.deep.equal(basicHtml);
        });
    });

    describe('with styles', function () {
      function reject(err) {
        expect(err).to.be.an.instanceOf(Error);
      }

      function resolveBody(html) {
        expect(html).to.deep.equal(componentStyleHtml);
      }

      function resolveSection(html) {
        expect(html).to.deep.equal(componentStyleSection);
      }

      // Body HTML
      it('adds to bottom of head', function () {
        components.getStyles.onCall(0).returns(['article.css']);
        files.readFilePromise.onCall(0).returns(Promise.resolve(styleString));

        fn(mediaMap({scripts:[], styles: ['/css/article.css']}), locals)(basicHtml)
          .then(resolveBody);
      });

      // Error
      it('throws an error if there is an error reading the file', function () {
        components.getStyles.onCall(0).returns(['/css/a.css']);
        files.readFilePromise.onCall(0).returns(Promise.resolve(''));
        files.readFilePromise.onCall(1).returns(Promise.reject(new Error()));

        fn(mediaMap({scripts:[], styles: ['/css/a.css']}), locals)(basicHtml)
          .catch(reject);
      });

      // Section HTML
      it('adds to top of root', function () {
        components.getStyles.onCall(0).returns(['/css/article.css']);
        files.readFilePromise.onCall(0).returns(Promise.resolve(styleString));

        fn(mediaMap({scripts:[], styles: ['/css/article.css']}), locals)(basicSection)
          .then(resolveSection);
      });
    });

    describe('with scripts', function () {
      function resolveBody(html) {
        expect(html).to.deep.equal(componentScriptHtml);
      }

      function resolveSection(html) {
        expect(html).to.deep.equal(componentScriptSection);
      }

      it('adds to bottom of body', function () {
        components.getScripts.onCall(0).returns(['/js/a.js']);
        files.readFilePromise.onCall(0).returns(Promise.resolve(''));
        files.readFilePromise.onCall(1).returns(Promise.resolve(scriptString));

        fn(mediaMap({scripts:['/js/a.js'], styles: []}), locals)(basicHtml)
          .then(resolveBody);
      });

      it('adds to bottom of root', function () {
        components.getStyles.onCall(0).returns(['/js/a.js']);
        files.readFilePromise.onCall(0).returns(Promise.resolve(''));
        files.readFilePromise.onCall(1).returns(Promise.resolve(scriptString));

        fn(mediaMap({scripts:['/js/a.js'], styles: []}), locals)(basicSection)
          .then(resolveSection);
      });
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
      const componentList = [],
        data = {},
        locals = {site: {}};

      expect(function () {
        fn(componentList, data, locals);
      }).to.throw(TypeError);
    });

    it('does not set media if missing components', function () {
      const componentList = [],
        data = {},
        locals = {site: {slug: 'hey'}};

      fn(componentList, data, locals);

      expect(data.media).to.equal(undefined);
    });

    it('sets media if components have styles and scripts', function () {
      const siteName = 'some site',
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
      const siteName = 'some site',
        componentList = ['a', 'e'],
        data = {},
        locals = {site: {
          slug: siteName,
          resolveMedia() {
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
      const siteName = 'some site',
        componentList = ['a', 'e'],
        data = {},
        locals = {site: {
          slug: siteName,
          resolveMedia(media) {
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
