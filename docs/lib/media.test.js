'use strict';

const _ = require('lodash'),
  filename = __filename.split('/').pop().split('.').shift(),
  lib = require('./' + filename),
  expect = require('chai').expect,
  sinon = require('sinon'),
  components = require('./services/components');

describe(_.startCase(filename), function () {
  let sandbox;

  beforeEach(function () {
    sandbox = sinon.sandbox.create();
    sandbox.stub(components);
  });

  afterEach(function () {
    sandbox.restore();
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

      expect(fn(componentList, data, locals)).to.deep.equal({
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

      expect(fn(componentList, data, locals)).to.deep.equal({
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

      expect(fn(componentList, data, locals)).to.deep.equal({
        styles: ['/j/k'],
        scripts: ['/h/i', '/x/y']
      });
    });
  });
});
