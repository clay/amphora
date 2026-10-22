'use strict';

const _ = require('lodash'),
  filename = __filename.split('/').pop().split('.').shift(),
  lib = require('./' + filename),
  expect = require('chai').expect,
  sinon = require('sinon');

describe(_.startCase(filename), function () {
  let sandbox;

  beforeEach(function () {
    sandbox = sinon.createSandbox();
  });

  afterEach(function () {
    sandbox.restore();
  });

  describe('replaceAllVersions', function () {
    const fn = lib[this.title];

    it('replaces all versions with new version', function () {
      expect(fn('c')({_ref: 'x@x', deep: {_ref: 'a@b', thing: {_ref: 'a'}}})).to.deep.equal({_ref: 'x@x', deep: {_ref: 'a@c', thing: {_ref: 'a@c'}}});
    });

    it('replaces all versions with no version', function () {
      expect(fn()({_ref: 'x@x', deep: {_ref: 'a@b', thing: {_ref: 'a'}}})).to.deep.equal({_ref: 'x@x', deep: {_ref: 'a', thing: {_ref: 'a'}}});
    });
  });

  describe('setPropagatingVersions', function () {
    const fn = lib[this.title];
    let originalValue;

    before(function () {
      originalValue = lib.getPropagatingVersions();
    });

    after(function () {
      lib.setPropagatingVersions(originalValue);
    });

    it('sets', function () {
      expect(function () { fn([]); }).to.not.throw();
    });
  });

  describe('isUrl', function () {
    const fn = lib[this.title];

    it('is false when given undefined', function () {
      expect(fn()).to.equal(false);
    });

    it('knows a url without path', function () {
      expect(fn('http://something.com')).to.equal(true);
    });

    it('knows a url with empty', function () {
      expect(fn('http://something.com/')).to.equal(true);
    });

    it('knows a url with port', function () {
      expect(fn('http://something.com:3333/')).to.equal(true);
    });

    it('fails without protocol', function () {
      expect(fn('something.com:3333')).to.equal(false);
    });
  });

  describe('isUri', function () {
    const fn = lib[this.title];

    it('is false when given undefined', function () {
      expect(fn()).to.equal(false);
    });

    it('knows not a uri with protocol', function () {
      expect(fn('http://something.com')).to.equal(false);
    });

    it('knows not a uri with port', function () {
      expect(fn('something.com:3333')).to.equal(false);
    });

    it('knows not a uri with protocol and path', function () {
      expect(fn('http://something.com/something')).to.equal(false);
    });

    it('knows not a uri without protocol with path', function () {
      expect(fn('something.com:3333/something')).to.equal(false);
    });

    it('knows a uri with path', function () {
      expect(fn('something.com/something')).to.equal(true);
    });

    it('knows a uri without path', function () {
      expect(fn('something.com')).to.equal(true);
    });
  });

  describe('uriToUrl', function () {
    const fn = lib[this.title];

    it('converts without protocol and port', function () {
      expect(fn('localhost')).to.equal('http://localhost/');
    });

    it('converts given protocol and port', function () {
      expect(fn('localhost', 'https', '3333')).to.equal('https://localhost:3333/');
    });

    it('does not say port 80 for http', function () {
      expect(fn('localhost', 'http', '80')).to.equal('http://localhost/');
    });

    it('does not say port 443 for https', function () {
      expect(fn('localhost', 'https', '443')).to.equal('https://localhost/');
    });

    it('does not say a numeric default port', function () {
      expect(fn('localhost', 'http', 80)).to.equal('http://localhost/');
      expect(fn('localhost', 'https', 443)).to.equal('https://localhost/');
    });

    it('keeps port 443 for http', function () {
      expect(fn('localhost', 'http', '443')).to.equal('http://localhost:443/');
    });

    it('keeps port 80 for https', function () {
      expect(fn('localhost', 'https', '80')).to.equal('https://localhost:80/');
    });

    describe('without a port or PORT env', function () {
      let originalPort;

      beforeEach(function () {
        originalPort = process.env.PORT;
        delete process.env.PORT;
      });

      afterEach(function () {
        if (originalPort === undefined) {
          delete process.env.PORT;
        } else {
          process.env.PORT = originalPort;
        }
      });

      it('converts http', function () {
        expect(fn('localhost/path', 'http')).to.equal('http://localhost/path');
      });

      // this used to throw "Cannot read properties of undefined (reading 'toString')"
      it('converts https', function () {
        expect(fn('localhost/path', 'https')).to.equal('https://localhost/path');
      });
    });
  });

  describe('urlToUri', function () {
    const fn = lib[this.title];

    it('throws with invalid url', function () {
      expect(function () { fn('localhost'); }).to.throw();
    });

    it('converts without port', function () {
      expect(fn('http://localhost')).to.equal('localhost/');
    });

    it('converts with port', function () {
      expect(fn('http://localhost:3333')).to.equal('localhost/');
    });

    it('converts without port with path', function () {
      expect(fn('http://localhost/some-path')).to.equal('localhost/some-path');
    });

    it('converts with port', function () {
      expect(fn('http://localhost:3333/some-path')).to.equal('localhost/some-path');
    });

    it('decodes characters that url.parse encodes', function () {
      expect(fn('http://localhost:3333/author/person-l\'cool')).to.equal('localhost/author/person-l\'cool');
    });
  });

  describe('listDeepObjects', function () {
    const fn = lib[this.title];

    /**
     * The implementation from before listDeepObjects pushed in place. The
     * tests below check that the new one returns the same objects in the
     * same order.
     * @param {object} obj
     * @param {Function} [filter=_.identity]
     * @returns {array}
     */
    function concatListDeepObjects(obj, filter) {
      let cursor, items,
        list = [],
        queue = [obj];

      while (queue.length) {
        cursor = queue.pop();
        items = _.filter(cursor, _.isObject);
        list = list.concat(_.filter(items, filter || _.identity));
        queue = queue.concat(items);
      }

      return list;
    }

    /**
     * Nested objects and arrays, some with refs, plus values that are not objects
     * @returns {object}
     */
    function nestedData() {
      return {
        _ref: 'root',
        a: { name: 'a', _ref: 'a', b: { name: 'b' }, c: [{ name: 'c0', _ref: 'c0' }, { name: 'c1' }] },
        d: [{ name: 'd0', e: { name: 'e', _ref: 'e' } }, [{ name: 'd1-0', _ref: 'd1-0' }]],
        f: { name: 'f', _ref: 'f', g: { name: 'g', h: { name: 'h', _ref: 'h' } } },
        s: 'string',
        n: 1,
        z: null
      };
    }

    /**
     * A page-sized component with many child refs
     * @returns {object}
     */
    function largeData() {
      const data = { _ref: 'site/_components/article/instances/a', content: [], authors: [] };
      let i;

      for (i = 0; i < 500; i++) {
        data.content.push({
          _ref: `site/_components/paragraph/instances/${i}`,
          text: 'text',
          embed: i % 10 === 0 ? { _ref: `site/_components/embed/instances/${i}`, size: { w: 1, h: 2 } } : null,
          tags: [{ text: 'tag' }]
        });
      }
      for (i = 0; i < 5; i++) {
        data.authors.push({ text: 'author', social: { twitter: 'x' } });
      }

      return data;
    }

    /**
     * @param {object|array} obj
     * @returns {string}
     */
    function label(obj) {
      return obj.name || (Array.isArray(obj) ? `array(${obj.length})` : '?');
    }

    /**
     * Same objects (not copies) in the same order as the old implementation
     * @param {object} data
     * @param {*} [filter]
     */
    function expectSameAsConcat(data, filter) {
      const expected = concatListDeepObjects(data, filter);

      expect(expected).to.not.be.empty;
      expect(fn(data, filter)).to.have.ordered.members(expected);
    }

    it('lists every object in the same order as before', function () {
      expect(_.map(fn(nestedData()), label)).to.deep.equal(['a', 'array(2)', 'f', 'g', 'h', 'd0', 'array(1)', 'd1-0', 'e', 'b', 'array(2)', 'c0', 'c1']);
    });

    it('lists objects with a property in the same order as before', function () {
      expect(_.map(fn(nestedData(), '_ref'), label)).to.deep.equal(['a', 'f', 'h', 'd1-0', 'e', 'c0']);
    });

    it('lists objects matching a function in the same order as before', function () {
      expect(_.map(fn(nestedData(), obj => /^[a-c]/.test(obj.name)), label)).to.deep.equal(['a', 'b', 'c0', 'c1']);
    });

    it('returns the same objects as before with no filter', function () {
      expectSameAsConcat(nestedData());
      expectSameAsConcat(largeData());
    });

    it('returns the same objects as before when filtering by property', function () {
      expectSameAsConcat(nestedData(), '_ref');
      expectSameAsConcat(largeData(), '_ref');
    });

    it('returns the same objects as before when filtering by function', function () {
      expectSameAsConcat(nestedData(), obj => !!obj.name);
      expectSameAsConcat(largeData(), obj => _.includes(obj._ref, 'embed'));
    });

    it('returns the same objects as before when filtering by matching object', function () {
      expectSameAsConcat(largeData(), { text: 'tag' });
    });

    it('returns the same objects as before for an array', function () {
      expectSameAsConcat([{ _ref: 'a', b: [{ _ref: 'b' }] }, [{ _ref: 'c' }], 'd', null], '_ref');
    });

    it('returns an empty list when there are no objects', function () {
      expect(fn({ a: 'b', c: 1 })).to.deep.equal([]);
      expect(fn('string')).to.deep.equal([]);
      expect(fn(null)).to.deep.equal([]);
    });

    it('listDeepObjects gets all deep objects', function () {
      const result = fn({a:{b:{c:{d:'e'}}, f:{g:{h:'e'}}}});

      expect(result).to.have.length(5);
    });

    it('listDeepObjects can filter by existence of properties', function () {
      const result = fn({a:{b:{c:{d:'e'}}, f:{d:{g:'e'}}}}, 'd');

      expect(result).to.have.length(2);
    });

    it('listDeepObjects can filter by component', function () {
      const result = fn({a: {type:'yarn'}, b: {c: {type:'sweater'}}}, function (obj) { return !!obj.type; });

      expect(result).to.deep.equal([
        {type:'yarn'},
        {type:'sweater'}
      ]);
    });
  });
});
