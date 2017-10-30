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
  upgrade = require('./upgrade'),
  expect = require('chai').expect;

describe(_.startCase(filename), function () {
  const timeoutConstant = 100;
  let sandbox,
    savedTimeoutConstant,
    logFn;

  beforeEach(function () {
    sandbox = sinon.sandbox.create();
    logFn = sandbox.stub();

    sandbox.stub(db);
    sandbox.stub(siteService);
    sandbox.stub(files);
    sandbox.stub(timer);
    sandbox.stub(upgrade);

    lib.getPossibleTemplates.cache = new _.memoize.Cache();
    lib.getSchema.cache = new _.memoize.Cache();
    lib.getScripts.cache = new _.memoize.Cache();
    lib.getStyles.cache = new _.memoize.Cache();
    lib.setLog(logFn);

    savedTimeoutConstant = lib.getTimeoutConstant();
    lib.setTimeoutConstant(timeoutConstant);
    lib.setLog(logFn);
  });

  afterEach(function () {
    sandbox.restore();
    lib.setTimeoutConstant(savedTimeoutConstant);
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
      const reference = 'domain.com/path/_components/whatever',
        template = 'template.handlebars';

      files.getComponentPath.returns('asdf');
      sandbox.stub(glob, 'sync').returns([template]);

      expect(fn(reference, 'template')).to.eql(template);
    });

    it('returns template from node_modules', function () {
      const reference = 'domain.com/path/_components/whatever',
        template = 'template.handlebars';

      files.getComponentPath.returns('asdf/node_modules/asdf');
      sandbox.stub(glob, 'sync').returns([template]);

      expect(fn(reference, 'template')).to.eql(template);
    });
  });

  describe('del', function () {
    const fn = lib[this.title],
      fakeSite = {host: 'domain.com', path: '/path', slug: 'domain'};

    it('deletes', function () {
      db.get.returns(bluebird.resolve('{}'));
      db.del.returns(bluebird.resolve());
      files.getComponentModule.withArgs('whatever').returns(null);
      return fn('domain.com/path/_components/whatever', {site: fakeSite});
    });

    it('deletes using component module', function () {
      db.get.returns(bluebird.resolve('{}'));
      files.getComponentModule.returns({delete: _.constant(bluebird.resolve())});
      return fn('domain.com/path/_components/whatever', {site: fakeSite});
    });

    it('deletes using component module gives locals', function () {
      const ref = 'domain.com/path/_components/whatever',
        locals = { site: fakeSite },
        delSpy = sandbox.spy(_.constant(bluebird.resolve()));

      db.get.returns(bluebird.resolve('{}'));
      files.getComponentModule.returns({delete: delSpy});
      return fn(ref, locals).then(function () {
        sinon.assert.called(files.getComponentModule);
        sinon.assert.calledWith(delSpy, ref, {}, locals);
      });
    });
  });

  describe('simplePut', function () {
    const fn = lib[this.title];

    it('does not swap prefix if no site is defined', function () {
      const ref = 'a',
        locals = { componenthooks: false },
        data = {a: 'b', c: {_ref:'d', e: 'f'}},
        putSpy = sinon.stub(),
        response = { key: 'a', type: 'put', value: '{"h":"i"}' };

      files.getComponentModule.returns({save: putSpy});
      db.batch.returns(bluebird.resolve());
      putSpy.withArgs('a', sinon.match.object).returns({h: 'i'});

      return fn(ref, data, locals).then(function (resp) {
        sinon.assert.called(files.getComponentModule);
        expect(resp).to.eql(response);
      });
    });

    it('does not swap prefix if no site is defined and there is no model', function () {
      const ref = 'a',
        locals = { componenthooks: false },
        data = {a: 'b', c: {_ref:'d', e: 'f'}},
        response = [{ type: 'put',
          key: 'a',
          value: '{"a":"b","c":{"_ref":"d","e":"f"}}'
        }];

      files.getComponentModule.returns({});
      db.batch.returns(bluebird.resolve());
      expect(fn(ref, data, locals)).to.eql(response);
    });
  });

  describe('put', function () {
    const fn = lib[this.title];

    it('throw exception if ops length is 0', function (done) {
      const ref = 'a',
        data = {};

      sandbox.stub(lib, 'getPutOperations').returns(bluebird.resolve([]));

      fn(ref, data, {site: {}}).then(done).catch(function (error) {
        expect(error.message).to.equal('Component module PUT failed to create batch operations: a');
        done();
      });
    });

    it('throw exception if model does not return object', function (done) {
      const ref = 'a',
        data = {},
        putSpy = sinon.stub();

      putSpy.returns('abc');
      files.getComponentModule.returns({save: putSpy});
      db.batch.returns(bluebird.resolve());

      fn(ref, data, {site: {}}).then(done).catch(function (error) {
        expect(error.message).to.equal('Unable to save a: Data from model.save must be an object!');
        done();
      });
    });

    it('logs warning if operation is slow', function () {
      const ref = 'a',
        data = {},
        saveSpy = sinon.stub(),
        moduleDataValue = {b: 'c'},
        moduleData = { key: 'a', type: 'put', value: JSON.stringify(moduleDataValue) };

      timer.getMillisecondsSince.returns(timeoutConstant * 7);
      saveSpy.withArgs('a', sinon.match.object).returns([moduleData]);
      files.getComponentModule.returns({save: saveSpy});
      db.batch.returns(bluebird.resolve());

      return fn(ref, data, { site: {}, componenthooks: 'true' }).then(function () {
        sinon.assert.calledWith(logFn, 'warn', sinon.match('slow put a 700ms'));
      });
    });

    it('puts', function () {
      const ref = 'a',
        data = {};

      db.batch.returns(bluebird.resolve());

      return fn(ref, data, {site: {}}).then(function () {
        expect(db.batch.getCall(0).args[0]).to.deep.contain.members([{ key: 'a', type: 'put', value: '{}' }]);
      });
    });

    it('returns original object if successful', function () {
      const ref = 'a',
        data = {};

      db.batch.returns(bluebird.resolve());

      return fn(ref, data, {site: {}}).then(function (result) {
        expect(result).to.deep.equal({});
      });
    });

    it('cascades', function () {
      const ref = 'a',
        data = {a: 'b', c: {_ref:'d', e: 'f'}};

      db.batch.returns(bluebird.resolve());

      return fn(ref, data, {site: {}}).then(function () {
        const ops = db.batch.getCall(0).args[0];

        expect(ops).to.deep.contain.members([
          { key: 'd', type: 'put', value: JSON.stringify({e: 'f'}) },
          { key: 'a', type: 'put', value: JSON.stringify({a: 'b', c: { _ref: 'd'}}) }
        ]);
      });
    });

    it('cascades with component models gives locals', function () {
      const ref = 'a',
        locals = {site: {}},
        data = {a: 'b', c: {_ref:'d', e: 'f'}},
        putSpy = sinon.stub();

      files.getComponentModule.returns({save: putSpy});
      db.batch.returns(bluebird.resolve());
      putSpy.withArgs('a', sinon.match.object).returns({h: 'i'});
      putSpy.withArgs('d', sinon.match.object).returns({k: 'l'});

      return fn(ref, data, locals).then(function () {
        sinon.assert.called(files.getComponentModule);
        sinon.assert.calledWith(putSpy.firstCall, 'd', { e: 'f' }, locals);
        sinon.assert.calledWith(putSpy.secondCall, 'a', { a: 'b', c: { _ref: 'd' } }, locals);
      });
    });

    it('returns basic root object if successful even if cascading', function () {
      const ref = 'a',
        data = {a: 'b', c: {_ref:'d', e: 'f'}};

      db.batch.returns(bluebird.resolve([]));

      return fn(ref, data, {site: {}}).then(function (result) {
        expect(result).to.deep.equal({ a: 'b', c: { _ref: 'd' } });
      });
    });

    it('puts with default behavior if componenthooks is explicitly false', function () {
      const ref = 'a',
        data = {},
        putSpy = sinon.stub();

      db.batch.returns(bluebird.resolve());
      files.getComponentModule.returns({save: putSpy});
      return fn(ref, data, { site: {}, componenthooks: 'false' }).then(function () {
        expect(db.batch.getCall(0).args[0]).to.deep.contain.members([{ key: 'a', type: 'put', value: '{}' }]);
      });
    });
  });

  describe('publish', function () {
    const fn = lib[this.title];

    it('publishes if given data', function () {
      const uri = 'some uri',
        data = {a: 'b'},
        fakeSite = {host: 'd', path: '', slug: 'd', prefix: 'd'};

      db.batch.returns(bluebird.resolve());

      return fn(uri, data, {site: fakeSite}).then(function (result) {
        expect(result).to.deep.equal(data);
        sinon.assert.calledWith(db.batch, [{ type: 'put', key: 'some uri', value: JSON.stringify(data) }]);
      });
    });

    it('publishes latest composed data if not given data', function () {
      const uri = 'some uri',
        deepUri = 'd/_components/e/instances/f',
        data = {a: 'b', c: {_ref: deepUri}},
        deepData = {g: 'h'},
        fakeSite = {host: 'd', path: '', slug: 'd', prefix: 'd'};

      db.batch.returns(bluebird.resolve());
      db.get.withArgs(uri).returns(bluebird.resolve(JSON.stringify(data)));
      db.get.withArgs(deepUri).returns(bluebird.resolve(JSON.stringify(deepData)));

      return fn(uri, undefined, {site: fakeSite}).then(function (result) {
        expect(result).to.deep.equal(data);
        sinon.assert.calledWith(db.batch, [
          { key: 'd/_components/e/instances/f', type: 'put', value: '{"g":"h"}' },
          { key: 'some uri', type: 'put', value: '{"a":"b","c":{"_ref":"d/_components/e/instances/f"}}'}
        ]);
      });
    });

    it('publishes latest composed data if not given data, but not base components', function () {
      const uri = 'd/_components/coolUri',
        deepUri = 'd/_components/e',
        data = {a: 'b', c: {_ref: deepUri}},
        deepData = {g: 'h'},
        fakeSite = {host: 'd', path: '', slug: 'd', prefix: 'd'};

      db.batch.returns(bluebird.resolve());
      db.get.withArgs(uri).returns(bluebird.resolve(JSON.stringify(data)));
      db.get.withArgs(deepUri).returns(bluebird.resolve(JSON.stringify(deepData)));

      return fn(uri, undefined, {site: fakeSite}).then(function (result) {
        expect(result).to.deep.equal(data);
        sinon.assert.calledWith(db.batch, [
          { key: uri, type: 'put', value: '{"a":"b","c":{"_ref":"d/_components/e"}}'}
        ]);
      });
    });
  });

  describe('get', function () {
    const fn = lib[this.title],
      domainSite = { host: 'domain.com', path: '/path', slug: 'domain'};

    it('gets', function () {
      db.get.returns(bluebird.resolve('{}'));
      upgrade.init.returns(bluebird.resolve('{}'));
      files.getComponentModule.withArgs('whatever').returns(null);
      return fn('domain.com/path/_components/whatever', {site: domainSite});
    });

    it('blocks get that returns non-object', function (done) {
      db.get.returns(bluebird.resolve('"a"'));
      files.getComponentModule.withArgs('whatever').returns(null);
      fn('domain.com/path/_components/whatever', {site: domainSite}).then(done).catch(function () {
        done();
      });
    });

    it('gets even with bad name', function () {
      db.get.returns(bluebird.resolve('{}'));
      files.getComponentModule.withArgs('whatever').returns(null);
      return fn('bad name', {site: domainSite});
    });

    it('gets using component model', function () {
      const ref = 'domain.com/path/_components/whatever',
        renderSpy = sinon.stub();

      db.get.returns(Promise.resolve(JSON.stringify({a: 'b'})));
      upgrade.init.returns(Promise.resolve({a: 'b'}));
      renderSpy.returns({ a: 'b' });
      files.getComponentModule.returns({render: renderSpy});
      return fn(ref, {site: domainSite}).then(function () {
        sinon.assert.called(files.getComponentModule);
        sinon.assert.calledWith(renderSpy, ref);
      });
    });

    it('blocks component model returning non-object', function (done) {
      const ref = 'domain.com/path/_components/whatever',
        renderSpy = sinon.stub();

      db.get.returns(Promise.resolve(JSON.stringify({})));
      renderSpy.returns('abc');
      files.getComponentModule.returns({render: renderSpy});
      fn(ref, {site: domainSite}).then(done).catch(function (error) {
        expect(error.message).to.equal('Component module must return object, not string: domain.com/path/_components/whatever');
        done();
      });
    });

    it('gets directly from db if componenthooks is explicitly false', function () {
      const ref = 'domain.com/path/_components/whatever',
        renderSpy = sinon.stub();

      db.get.returns(bluebird.resolve('{}'));
      files.getComponentModule.returns({render: renderSpy});
      return fn(ref, { site: domainSite, componenthooks: 'false' }).then(function () {
        sinon.assert.called(files.getComponentModule);
        sinon.assert.calledWith(db.get, ref.replace('domain.com/path', 'domain'));
      });
    });

    it('logs warning for slow component', function () {
      const ref = 'domain.com/path/_components/whatever',
        render = sandbox.stub().returns(bluebird.resolve({}));

      db.get.returns(bluebird.resolve('{}'));
      timer.getMillisecondsSince.returns(timeoutConstant * 3);
      upgrade.init.returns(bluebird.resolve({}));
      files.getComponentModule.returns({ render });

      return fn(ref, { site: domainSite, componenthooks: true }).then(function () {
        sinon.assert.calledWith(logFn, 'warn', sinon.match('slow get domain.com/path/_components/whatever 300ms'));
      });

    });

    it('gets using component model with locals', function () {
      const ref = 'domain.com/path/_components/whatever',
        locals = { site: domainSite, componenthooks: true },
        renderSpy = sinon.stub(),
        data = {a: 'b'};

      db.get.returns(Promise.resolve(JSON.stringify(data)));
      renderSpy.returns({ _ref: ref, a: 'b' });
      files.getComponentModule.returns({render: renderSpy});
      return fn(ref, locals).then(function () {
        sinon.assert.called(files.getComponentModule);
        sinon.assert.calledWith(renderSpy, ref, data, locals);
      });
    });
  });

  describe('list', function () {
    const fn = lib[this.title];

    it('gets a list of components', function () {
      files.getComponents.returns(bluebird.resolve([]));
      return fn('domain.com/path/_components');
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
      const ref = '/_components/thing/instances/abc',
        data = {},
        result = {
          refs: { '/_components/thing/instances/abc': {} },
          components: ['thing']
        };

      expect(fn(ref, data)).to.deep.equal(result);
    });

    it('allows good ref, data with references', function () {
      const ref = '/_components/thing/instances/abc',
        data = {
          a: 'b',
          c: {_ref: '/_components/d/instances/e'},
          f: {_ref: '/_components/g'},
          h: {
            _ref: '/_components/i',
            j: {_ref:'/_components/k'}
          },
          l: {_ref: '/_components/g'},
          m: {_ref: '/_components/g/instances/n'}
        },
        result = {
          refs: {
            '/_components/d/instances/e': { _ref: '/_components/d/instances/e' },
            '/_components/g': { _ref: '/_components/g' },
            '/_components/g/instances/n': { _ref: '/_components/g/instances/n' },
            '/_components/i': { _ref: '/_components/i', j: {_ref:'/_components/k'} },
            '/_components/k': { _ref: '/_components/k' },
            '/_components/thing/instances/abc': {
              a: 'b',
              c: {_ref: '/_components/d/instances/e'},
              f: {_ref: '/_components/g'},
              h: {
                _ref: '/_components/i',
                j: {_ref:'/_components/k'}
              },
              l: {_ref: '/_components/g'},
              m: {_ref: '/_components/g/instances/n'}
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
