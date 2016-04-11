'use strict';

const _ = require('lodash'),
  filename = __filename.split('/').pop().split('.').shift(),
  lib = require('./' + filename),
  sinon = require('sinon'),
  files = require('../files'),
  siteService = require('./sites'),
  db = require('./db'),
  timer = require('../timer'),
  glob = require('glob'),
  bluebird = require('bluebird'),
  expect = require('chai').expect,
  winston = require('winston');

describe(_.startCase(filename), function () {
  const timeoutConstant = 100;
  let sandbox,
    savedTimeoutConstant;

  beforeEach(function () {
    sandbox = sinon.sandbox.create();

    sandbox.stub(db);
    sandbox.stub(siteService);
    sandbox.stub(files);
    sandbox.stub(winston);
    sandbox.stub(timer);

    lib.getPossibleTemplates.cache = new _.memoize.Cache();
    lib.getSchema.cache = new _.memoize.Cache();
    lib.getScripts.cache = new _.memoize.Cache();
    lib.getStyles.cache = new _.memoize.Cache();

    savedTimeoutConstant = lib.getTimeoutConstant();
    lib.setTimeoutConstant(timeoutConstant);
  });

  afterEach(function () {
    sandbox.restore();
    lib.setTimeoutConstant(savedTimeoutConstant);
  });

  describe('getName', function () {
    const fn = lib[this.title];

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
    const fn = lib[this.title];

    it('throws error if no template name provided', function () {
      sandbox.stub(glob, 'sync').returns([]);
      expect(function () {
        fn('');
      }).to.throw();
    });

    it('does not throw error if no templates found', function () {
      sandbox.stub(glob, 'sync').returns([]);
      expect(function () {
        fn('', 'template');
      }).to.not.throw();
    });

    it('returns template', function () {
      const reference = 'domain.com/path/components/whatever',
        template = 'template.nunjucks';

      files.getComponentPath.returns('asdf');
      sandbox.stub(glob, 'sync').returns([template]);

      expect(fn(reference, 'template')).to.eql(template);
    });

    it('returns template from node_modules', function () {
      const reference = 'domain.com/path/components/whatever',
        template = 'template.nunjucks';

      files.getComponentPath.returns('asdf/node_modules/asdf');
      sandbox.stub(glob, 'sync').returns([template]);

      expect(fn(reference, 'template')).to.eql(template);
    });
  });

  describe('putDefaultBehavior', function () {
    const fn = lib[this.title];

    it('puts to latest', function () {
      expect(fn('domain.com/path/components/whatever', {})).to.deep.equal([{
        type: 'put',
        key: 'domain.com/path/components/whatever',
        value: '{}'
      }]);
    });

    it('puts to latest explicitly', function () {
      expect(fn('domain.com/path/components/whatever@latest', {})).to.deep.equal([{
        type: 'put',
        key: 'domain.com/path/components/whatever',
        value: '{}'
      }]);
    });

    it('puts to tag', function () {
      expect(fn('domain.com/path/components/whatever@tag', {})).to.deep.equal([{
        type: 'put',
        key: 'domain.com/path/components/whatever@tag',
        value: '{}'
      }]);
    });

    it('puts to published', function () {
      expect(fn('domain.com/path/components/whatever@published', {})).to.deep.equal([{
        type: 'put',
        key: 'domain.com/path/components/whatever@published',
        value: '{}'
      }]);
    });
  });

  describe('putTag', function () {
    const fn = lib[this.title];

    it('puts to tag even with other version/tag', function () {
      expect(fn('domain.com/path/components/whatever@tag', {}, 'special')).to.deep.equal([{
        type: 'put',
        key: 'domain.com/path/components/whatever@special',
        value: '{}'
      }]);
    });

    it('puts to tag', function () {
      expect(fn('domain.com/path/components/whatever', {}, 'special')).to.deep.equal([{
        type: 'put',
        key: 'domain.com/path/components/whatever@special',
        value: '{}'
      }]);
    });
  });

  describe('putPublished', function () {
    const fn = lib[this.title];

    it('puts to published even with other version/tag', function () {
      expect(fn('domain.com/path/components/whatever@something', {})).to.deep.equal([{
        type: 'put',
        key: 'domain.com/path/components/whatever@published',
        value: '{}'
      }]);
    });

    it('puts to published', function () {
      expect(fn('domain.com/path/components/whatever@published', {})).to.deep.equal([{
        type: 'put',
        key: 'domain.com/path/components/whatever@published',
        value: '{}'
      }]);
    });
  });

  describe('putLatest', function () {
    const fn = lib[this.title];

    it('puts to latest', function () {
      expect(fn('domain.com/path/components/whatever', {})).to.deep.equal([{
        type: 'put',
        key: 'domain.com/path/components/whatever',
        value: '{}'
      }]);
    });
  });

  describe('del', function () {
    const fn = lib[this.title];

    it('deletes', function () {
      db.get.returns(bluebird.resolve('{}'));
      db.del.returns(bluebird.resolve());
      files.getComponentModule.withArgs('whatever').returns(null);
      return fn('domain.com/path/components/whatever');
    });

    it('deletes using component module', function () {
      db.get.returns(bluebird.resolve('{}'));
      files.getComponentModule.returns({del: _.constant(bluebird.resolve())});
      return fn('domain.com/path/components/whatever');
    });

    it('deletes using component module gives locals', function () {
      const ref = 'domain.com/path/components/whatever',
        locals = {},
        delSpy = sandbox.spy(_.constant(bluebird.resolve()));

      db.get.returns(bluebird.resolve('{}'));
      files.getComponentModule.returns({del: delSpy});
      return fn(ref, locals).then(function () {
        sinon.assert.called(files.getComponentModule);
        sinon.assert.calledWith(delSpy, ref, locals);
      });
    });
  });

  describe('put', function () {
    const fn = lib[this.title];

    it('throw exception if module does not return any ops', function (done) {
      const ref = 'a',
        data = {},
        putSpy = sinon.stub();

      putSpy.withArgs('a', sinon.match.object).returns([]);
      files.getComponentModule.returns({put: putSpy});
      db.batch.returns(bluebird.resolve());

      fn(ref, data).then(done).catch(function (error) {
        expect(error.message).to.equal('Component module PUT failed to create batch operations: a');
        done();
      });
    });

    it('logs warning if operation is slow', function () {
      const ref = 'a',
        data = {},
        putSpy = sinon.stub(),
        moduleDataValue = {b: 'c'},
        moduleData = { key: 'a', type: 'put', value: JSON.stringify(moduleDataValue) };

      timer.getMillisecondsSince.returns(timeoutConstant * 7);
      putSpy.withArgs('a', sinon.match.object).returns([moduleData]);
      files.getComponentModule.returns({put: putSpy});
      db.batch.returns(bluebird.resolve());

      return fn(ref, data).then(function () {
        sinon.assert.calledWith(winston.log, 'warn', sinon.match('slow put a 700ms'));
      });
    });

    it('puts', function () {
      const ref = 'a',
        data = {};

      db.batch.returns(bluebird.resolve());

      return fn(ref, data).then(function () {
        expect(db.batch.getCall(0).args[0]).to.deep.contain.members([{ key: 'a', type: 'put', value: '{}' }]);
      });
    });

    it('returns original object if successful', function () {
      const ref = 'a',
        data = {};

      db.batch.returns(bluebird.resolve());

      return fn(ref, data).then(function (result) {
        expect(result).to.deep.equal({});
      });
    });

    it('cascades', function () {
      const ref = 'a',
        data = {a: 'b', c: {_ref:'d', e: 'f'}};

      db.batch.returns(bluebird.resolve());

      return fn(ref, data).then(function () {
        const ops = db.batch.getCall(0).args[0];

        expect(ops).to.deep.contain.members([
          { key: 'd', type: 'put', value: JSON.stringify({e: 'f'}) },
          { key: 'a', type: 'put', value: JSON.stringify({a: 'b', c: { _ref: 'd'}}) }
        ]);
      });
    });

    it('cascades with component modules', function () {
      const ref = 'a',
        data = {a: 'b', c: {_ref:'d', e: 'f'}},
        rootModuleData = {type: 'put', key: 'g', value: JSON.stringify({h: 'i'})},
        deepModuleData = {type: 'put', key: 'j', value: JSON.stringify({k: 'l'})},
        putSpy = sinon.stub();

      files.getComponentModule.returns({put: putSpy});
      db.batch.returns(bluebird.resolve());
      putSpy.withArgs('a', sinon.match.object).returns([rootModuleData]);
      putSpy.withArgs('d', sinon.match.object).returns([deepModuleData]);

      return fn(ref, data).then(function () {
        sinon.assert.called(files.getComponentModule);
        expect(db.batch.getCall(0).args[0]).to.deep.contain.members([rootModuleData, deepModuleData]);
      });
    });

    it('cascades with component modules gives locals', function () {
      const ref = 'a',
        locals = {},
        data = {a: 'b', c: {_ref:'d', e: 'f'}},
        rootModuleData = {type: 'put', key: 'g', value: JSON.stringify({h: 'i'})},
        deepModuleData = {type: 'put', key: 'j', value: JSON.stringify({k: 'l'})},
        putSpy = sinon.stub();

      files.getComponentModule.returns({put: putSpy});
      db.batch.returns(bluebird.resolve());
      putSpy.withArgs('a', sinon.match.object).returns([rootModuleData]);
      putSpy.withArgs('d', sinon.match.object).returns([deepModuleData]);

      return fn(ref, data, locals).then(function () {
        sinon.assert.called(files.getComponentModule);
        sinon.assert.calledWith(putSpy.firstCall, 'd', { e: 'f' }, locals);
        sinon.assert.calledWith(putSpy.secondCall, 'a', { a: 'b', c: { _ref: 'd' } }, locals);
      });
    });

    it('locals are read-only', function () {
      const ref = 'a',
        locals = {},
        data = {a: 'b', c: {_ref:'d', e: 'f'}},
        rootModuleData = {type: 'put', key: 'g', value: JSON.stringify({h: 'i'})},
        deepModuleData = {type: 'put', key: 'j', value: JSON.stringify({k: 'l'})},
        putSpy = sinon.stub();

      files.getComponentModule.returns({put: putSpy});
      db.batch.returns(bluebird.resolve());
      putSpy.withArgs('a', sinon.match.object).returns([rootModuleData]);
      putSpy.withArgs('d', sinon.match.object).returns([deepModuleData]);

      return fn(ref, data, locals).then(function () {
        sinon.assert.called(files.getComponentModule);
        expect(Object.isFrozen(putSpy.firstCall.args[3])).to.equal(true);
        expect(Object.isFrozen(putSpy.secondCall.args[3])).to.equal(true);
      });
    });

    it('returns basic root object if successful even if cascading', function () {
      const ref = 'a',
        data = {a: 'b', c: {_ref:'d', e: 'f'}};

      db.batch.returns(bluebird.resolve([]));

      return fn(ref, data).then(function (result) {
        expect(result).to.deep.equal({ a: 'b', c: { _ref: 'd' } });
      });
    });
  });

  describe('publish', function () {
    const fn = lib[this.title];

    it('publishes if given data', function () {
      const uri = 'some uri',
        data = {a: 'b'};

      db.batch.returns(bluebird.resolve());

      return fn(uri, data).then(function (result) {
        expect(result).to.deep.equal(data);
        sinon.assert.calledWith(db.batch, [{ type: 'put', key: 'some uri', value: JSON.stringify(data) }]);
      });
    });

    it('publishes latest composed data if not given data', function () {
      const uri = 'some uri',
        deepUri = 'd/components/e/instances/f',
        data = {a: 'b', c: {_ref: deepUri}},
        deepData = {g: 'h'};

      db.batch.returns(bluebird.resolve());
      db.get.withArgs(uri).returns(bluebird.resolve(JSON.stringify(data)));
      db.get.withArgs(deepUri).returns(bluebird.resolve(JSON.stringify(deepData)));

      return fn(uri).then(function (result) {
        expect(result).to.deep.equal(data);
        sinon.assert.calledWith(db.batch, [
          { key: 'd/components/e/instances/f', type: 'put', value: '{"g":"h"}' },
          { key: 'some uri', type: 'put', value: '{"a":"b","c":{"_ref":"d/components/e/instances/f"}}'}
        ]);
      });
    });

    it('publishes latest composed data if not given data, but not base components', function () {
      const uri = 'some uri',
        deepUri = 'd/components/e',
        data = {a: 'b', c: {_ref: deepUri}},
        deepData = {g: 'h'};

      db.batch.returns(bluebird.resolve());
      db.get.withArgs(uri).returns(bluebird.resolve(JSON.stringify(data)));
      db.get.withArgs(deepUri).returns(bluebird.resolve(JSON.stringify(deepData)));

      return fn(uri).then(function (result) {
        expect(result).to.deep.equal(data);
        sinon.assert.calledWith(db.batch, [
          { key: 'some uri', type: 'put', value: '{"a":"b","c":{"_ref":"d/components/e"}}'}
        ]);
      });
    });
  });

  describe('get', function () {
    const fn = lib[this.title];

    it('gets', function () {
      db.get.returns(bluebird.resolve('{}'));
      files.getComponentModule.withArgs('whatever').returns(null);
      return fn('domain.com/path/components/whatever');
    });

    it('blocks get that returns non-object', function (done) {
      db.get.returns(bluebird.resolve('"a"'));
      files.getComponentModule.withArgs('whatever').returns(null);
      fn('domain.com/path/components/whatever').then(done).catch(function () {
        done();
      });
    });

    it('gets even with bad name', function () {
      db.get.returns(bluebird.resolve('{}'));
      files.getComponentModule.withArgs('whatever').returns(null);
      return fn('bad name');
    });

    it('gets using component module', function () {
      const ref = 'domain.com/path/components/whatever',
        someModule = sinon.spy(_.constant(bluebird.resolve({})));

      files.getComponentModule.returns(someModule);
      return fn(ref).then(function () {
        sinon.assert.called(files.getComponentModule);
        sinon.assert.calledWith(someModule, ref);
      });
    });

    it('blocks component module returning non-object', function (done) {
      const ref = 'domain.com/path/components/whatever',
        someModule = sinon.spy(_.constant(bluebird.resolve('{}')));

      files.getComponentModule.returns(someModule);
      fn(ref).then(done).catch(function (error) {
        expect(error.message).to.equal('Component module must return object, not string: domain.com/path/components/whatever');
        done();
      });
    });

    it('logs warning for slow component', function () {
      const ref = 'domain.com/path/components/whatever',
        someModule = sinon.spy(_.constant(bluebird.resolve({})));

      timer.getMillisecondsSince.returns(timeoutConstant * 3);

      files.getComponentModule.returns(someModule);
      return fn(ref).then(function () {
        sinon.assert.calledWith(winston.log, 'warn', sinon.match('slow get domain.com/path/components/whatever 300ms'));
      });
    });

    it('gets using component module with locals', function () {
      const ref = 'domain.com/path/components/whatever',
        locals = {},
        someModule = sinon.spy(_.constant(bluebird.resolve({})));

      files.getComponentModule.returns(someModule);
      return fn(ref, locals).then(function () {
        sinon.assert.called(files.getComponentModule);
        sinon.assert.calledWith(someModule, ref, locals);
      });
    });
  });

  describe('list', function () {
    const fn = lib[this.title];

    it('gets a list of components', function () {
      files.getComponents.returns(bluebird.resolve([]));
      return fn('domain.com/path/components');
    });
  });

  describe('getIndices', function () {
    const fn = lib[this.title];

    it('allows bad ref, empty data', function () {
      const ref = 'some ref',
        data = {},
        result = {
          refs: { 'some ref': {} },
          components: []
        };

      expect(fn(ref, data)).to.deep.equal(result);
    });

    it('allows good ref, empty data', function () {
      const ref = '/components/thing/instances/abc',
        data = {},
        result = {
          refs: { '/components/thing/instances/abc': {} },
          components: ['thing']
        };

      expect(fn(ref, data)).to.deep.equal(result);
    });

    it('allows good ref, data with references', function () {
      const ref = '/components/thing/instances/abc',
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
    const fn = lib[this.title];

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
    const fn = lib[this.title];

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
