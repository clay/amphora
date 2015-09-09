'use strict';

var _ = require('lodash'),
  filename = __filename.split('/').pop().split('.').shift(),
  lib = require('./' + filename),
  sinon = require('sinon'),
  files = require('../files'),
  siteService = require('../sites'),
  db = require('./db'),
  glob = require('glob'),
  bluebird = require('bluebird'),
  expect = require('chai').expect,
  log = require('../log');

describe(_.startCase(filename), function () {
  var sandbox;

  /**
   * Shortcut
   */
  function expectNoLogging() {
    var logExpectations = sandbox.mock(log);
    logExpectations.expects('info').never();
    logExpectations.expects('warn').never();
    logExpectations.expects('error').never();
  }

  beforeEach(function () {
    sandbox = sinon.sandbox.create();

    sandbox.stub(siteService);
    sandbox.stub(files);

    lib.getName.cache = new _.memoize.Cache();
    lib.getSchema.cache = new _.memoize.Cache();
    lib.getTemplate.cache = new _.memoize.Cache();
    lib.getScripts.cache = new _.memoize.Cache();
    lib.getStyles.cache = new _.memoize.Cache();

    expectNoLogging();
  });

  afterEach(function () {
    sandbox.restore();
  });

  describe('getName', function () {
    var fn = lib[this.title];

    it('finds /components/name', function () {
      expect(fn('/components/name')).to.equal('name');
    });

    it('finds /components/name/', function () {
      expect(fn('/components/name/')).to.equal('name');
    });

    it('finds /components/name/instances/id', function () {
      expect(fn('/components/name/instances/id')).to.equal('name');
    });

    it('finds /components/name.ext', function () {
      expect(fn('/components/name.ext')).to.equal('name');
    });

    it('finds /components/name@version', function () {
      expect(fn('/components/name@version')).to.equal('name');
    });

    it('finds domain.com/path/components/name', function () {
      expect(fn('domain.com/path/components/name')).to.equal('name');
    });

    it('finds domain.com/path/components/name/', function () {
      expect(fn('domain.com/path/components/name/')).to.equal('name');
    });

    it('finds domain.com/path/components/name/instances/id', function () {
      expect(fn('domain.com/path/components/name/instances/id')).to.equal('name');
    });

    it('finds domain.com/path/components/name.ext', function () {
      expect(fn('domain.com/path/components/name.ext')).to.equal('name');
    });

    it('finds domain.com/path/components/name@version', function () {
      expect(fn('domain.com/path/components/name@version')).to.equal('name');
    });
  });

  describe('getTemplate', function () {
    var fn = lib[this.title];

    it('throws error if no templates found', function () {
      sandbox.stub(glob, 'sync').returns([]);
      expect(function () {
        return fn('');
      }).to.throw(Error);
    });

    it('returns template', function () {
      var reference = 'domain.com/path/components/whatever',
        template = 'template.nunjucks';
      files.getComponentPath.returns('asdf');
      sandbox.stub(glob, 'sync').returns([template]);

      expect(fn(reference)).to.eql(template);
    });
  });

  describe('putDefaultBehavior', function () {
    var fn = lib[this.title];

    it('throws error on @list', function () {
      expect(function () {
        fn('domain.com/path/components/whatever@list', {});
      }).to.throw();
    });
  });

  describe('putTag', function () {
    var fn = lib[this.title];

    it('puts to tag', function () {
      fn('domain.com/path/components/whatever', {}, 'special');
    });
  });

  describe('putPublished', function () {
    var fn = lib[this.title];

    it('puts to published', function () {
      fn('domain.com/path/components/whatever', {});
    });

    it('puts to published with id', function () {
      fn('domain.com/path/components/whatever', {id: 'randomid'});
    });
  });


  describe('putLatest', function () {
    var fn = lib[this.title];

    it('puts to latest', function () {
      fn('domain.com/path/components/whatever', {});
    });
  });

  describe('del', function () {
    var fn = lib[this.title];

    it('deletes', function () {
      sandbox.stub(db, 'get').returns(bluebird.resolve('{}'));
      sandbox.stub(db, 'del').returns(bluebird.resolve());
      files.getComponentModule.withArgs('whatever').returns(null);
      return fn('domain.com/path/components/whatever');
    });

    it('deletes using component module', function () {
      sandbox.stub(db, 'get').returns(bluebird.resolve('{}'));
      files.getComponentModule.returns({del: _.constant(bluebird.resolve())});
      return fn('domain.com/path/components/whatever');
    });
  });

  describe('put', function () {
    var fn = lib[this.title];

    it('throws error if component module does not return promise', function () {

    });

    it('puts', function () {
      var ref = 'a',
        data = {};

      sandbox.stub(db, 'batch').returns(bluebird.resolve());

      return fn(ref, data).then(function () {
        expect(db.batch.getCall(0).args[0]).to.deep.contain.members([{ key: 'a', type: 'put', value: '{}' }]);
      });
    });

    it('returns original object if successful', function () {
      var ref = 'a',
        data = {};

      sandbox.stub(db, 'batch').returns(bluebird.resolve());

      return fn(ref, data).then(function (result) {
        expect(result).to.deep.equal({});
      });
    });

    it('cascades', function () {
      var ref = 'a',
        data = {a: 'b', c: {_ref:'d', e: 'f'}};

      sandbox.stub(db, 'batch').returns(bluebird.resolve());

      return fn(ref, data).then(function () {
        var ops = db.batch.getCall(0).args[0];
        expect(ops).to.deep.contain.members([
          { key: 'd', type: 'put', value: JSON.stringify({e: 'f'}) },
          { key: 'a', type: 'put', value: JSON.stringify({a: 'b', c: { _ref: 'd'}}) }
        ]);
      });
    });

    it('cascades with component modules', function () {
      var ref = 'a',
        data = {a: 'b', c: {_ref:'d', e: 'f'}},
        rootModuleData = {type: 'put', key: 'g', value: JSON.stringify({h: 'i'})},
        deepModuleData = {type: 'put', key: 'j', value: JSON.stringify({k: 'l'})},
        putSpy = sinon.stub();

      files.getComponentModule.returns({put: putSpy});
      sandbox.stub(db, 'batch').returns(bluebird.resolve());
      putSpy.withArgs('a', sinon.match.object).returns([rootModuleData]);
      putSpy.withArgs('d', sinon.match.object).returns([deepModuleData]);

      return fn(ref, data).then(function () {
        expect(db.batch.getCall(0).args[0]).to.deep.contain.members([rootModuleData, deepModuleData]);
      });
    });

    it('returns basic root object if successful even if cascading', function () {
      var ref = 'a',
        data = {a: 'b', c: {_ref:'d', e: 'f'}};

      sandbox.stub(db, 'batch').returns(bluebird.resolve([]));

      return fn(ref, data).then(function (result) {
        expect(result).to.deep.equal({ a: 'b', c: { _ref: 'd' } });
      });
    });
  });

  describe('get', function () {
    var fn = lib[this.title];

    it('gets', function () {
      sandbox.stub(db, 'get').returns(bluebird.resolve('{}'));
      files.getComponentModule.withArgs('whatever').returns(null);
      return fn('domain.com/path/components/whatever');
    });

    it('gets even with bad name', function () {
      sandbox.stub(db, 'get').returns(bluebird.resolve('{}'));
      files.getComponentModule.withArgs('whatever').returns(null);
      return fn('bad name');
    });

    it('gets using component module', function () {
      files.getComponentModule.returns(_.constant(bluebird.resolve()));
      return fn('domain.com/path/components/whatever');
    });
  });

  describe('list', function () {
    var fn = lib[this.title];

    it('gets a list of components', function () {
      files.getComponents.returns(bluebird.resolve([]));
      return fn('domain.com/path/components');
    });
  });

  describe('getIndices', function () {
    var fn = lib[this.title];

    it('allows bad ref, empty data', function () {
      var ref = 'some ref',
        data = {},
        result = {
          refs: { 'some ref': {} },
          components: []
        };

      expect(fn(ref, data)).to.deep.equal(result);
    });

    it('allows good ref, empty data', function () {
      var ref = '/components/thing/instances/abc',
        data = {},
        result = {
          refs: { '/components/thing/instances/abc': {} },
          components: ['thing']
        };

      expect(fn(ref, data)).to.deep.equal(result);
    });

    it('allows good ref, data with references', function () {
      var ref = '/components/thing/instances/abc',
        data = {
          a: 'b',
          c: {_ref: '/components/d/instances/e'},
          f: {_ref: '/components/g'},
          h: {
            _ref: '/components/i',
            j: {_ref:'/components/k'}
          },
          l: {_ref: '/components/g'},
          m: {_ref: '/components/g/instances/n'}
        },
        result = {
          refs: {
            '/components/d/instances/e': { _ref: '/components/d/instances/e' },
            '/components/g': { _ref: '/components/g' },
            '/components/g/instances/n': { _ref: '/components/g/instances/n' },
            '/components/i': { _ref: '/components/i', j: {_ref:'/components/k'} },
            '/components/k': { _ref: '/components/k' },
            '/components/thing/instances/abc': {
              a: 'b',
              c: {_ref: '/components/d/instances/e'},
              f: {_ref: '/components/g'},
              h: {
                _ref: '/components/i',
                j: {_ref:'/components/k'}
              },
              l: {_ref: '/components/g'},
              m: {_ref: '/components/g/instances/n'}
            }
          },
          components: ['thing', 'd', 'g', 'i', 'k']
        };

      expect(fn(ref, data)).to.deep.equal(result);
    });
  });

  describe('getScripts', function () {
    var fn = lib[this.title];

    it('accepts bad component', function () {
      siteService.sites.returns({});
      files.fileExists.returns(false);

      expect(fn('name')).to.deep.equal([]);
    });

    it('accepts good component', function () {
      siteService.sites.returns({});
      files.fileExists.onCall(0).returns(true);

      expect(fn('name')).to.deep.equal(['/js/name.js']);
    });

    it('accepts good component with slug (no slug file)', function () {
      siteService.sites.returns({});
      files.fileExists.onCall(0).returns(true);

      expect(fn('name', 'slug')).to.deep.equal(['/js/name.js']);
    });

    it('accepts good component with slug (with slug file)', function () {
      siteService.sites.returns({});
      files.fileExists.onCall(0).returns(true);
      files.fileExists.onCall(1).returns(true);

      expect(fn('name', 'slug')).to.deep.equal(['/js/name.js', '/js/name.slug.js']);
    });

    it('accepts good component with slug (with slug file) with assetDir', function () {
      siteService.sites.returns({slug: {assetDir: 'someAssetDir'}});
      files.fileExists.withArgs('someAssetDir/js/name.js').returns(true);
      files.fileExists.withArgs('someAssetDir/js/name.slug.js').returns(true);

      expect(fn('name', 'slug')).to.deep.equal(['/js/name.js', '/js/name.slug.js']);
    });

    it('accepts good component with slug (with slug file) with assetDir', function () {
      siteService.sites.returns({slug: {assetDir: 'someAssetDir', assetPath: '/someAssetPath'}});
      files.fileExists.withArgs('someAssetDir/js/name.js').returns(true);
      files.fileExists.withArgs('someAssetDir/js/name.slug.js').returns(true);

      expect(fn('name', 'slug')).to.deep.equal(['/someAssetPath/js/name.js', '/someAssetPath/js/name.slug.js']);
    });
  });

  describe('getStyles', function () {
    var fn = lib[this.title];

    it('accepts bad component', function () {
      siteService.sites.returns({});
      files.fileExists.returns(false);

      expect(fn('name')).to.deep.equal([]);
    });

    it('accepts good component', function () {
      siteService.sites.returns({});
      files.fileExists.onCall(0).returns(true);

      expect(fn('name')).to.deep.equal(['/css/name.css']);
    });

    it('accepts good component with slug (no slug file)', function () {
      siteService.sites.returns({});
      files.fileExists.onCall(0).returns(true);

      expect(fn('name', 'slug')).to.deep.equal(['/css/name.css']);
    });

    it('accepts good component with slug (with slug file)', function () {
      siteService.sites.returns({});
      files.fileExists.onCall(0).returns(true);
      files.fileExists.onCall(1).returns(true);

      expect(fn('name', 'slug')).to.deep.equal(['/css/name.css', '/css/name.slug.css']);
    });

    it('accepts good component with slug (with slug file) with assetDir', function () {
      siteService.sites.returns({slug: {assetDir: 'someAssetDir'}});
      files.fileExists.withArgs('someAssetDir/css/name.css').returns(true);
      files.fileExists.withArgs('someAssetDir/css/name.slug.css').returns(true);

      expect(fn('name', 'slug')).to.deep.equal(['/css/name.css', '/css/name.slug.css']);
    });

    it('accepts good component with slug (with slug file) with assetDir and assetPath', function () {
      siteService.sites.returns({slug: {assetDir: 'someAssetDir', assetPath: '/someAssetPath'}});
      files.fileExists.withArgs('someAssetDir/css/name.css').returns(true);
      files.fileExists.withArgs('someAssetDir/css/name.slug.css').returns(true);

      expect(fn('name', 'slug')).to.deep.equal(['/someAssetPath/css/name.css', '/someAssetPath/css/name.slug.css']);
    });
  });
});
