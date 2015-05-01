'use strict';
var _ = require('lodash'),
  filename = _.startCase(__filename.split('/').pop().split('.').shift()),
  references = require('./references'),
  expect = require('chai').expect,
  sinon = require('sinon'),
  files = require('./files'),
  db = require('./db'),
  schema = require('./schema'),
  config = require('config'),
  glob = require('glob'),
  bluebird = require('bluebird');

describe(filename, function () {
  var sandbox;

  beforeEach(function () {
    sandbox = sinon.sandbox.create();
  });

  afterEach(function () {
    sandbox.restore();
  });

  describe('getComponentName', function () {
    it('finds /components/name', function () {
      var result = references.getComponentName('/components/name');

      expect(result).to.equal('name');
    });
    it('finds /components/name/', function () {
      var result = references.getComponentName('/components/name/');

      expect(result).to.equal('name');
    });
    it('finds /components/name/instances/id', function () {
      var result = references.getComponentName('/components/name/instances/id');

      expect(result).to.equal('name');
    });
    it('finds /components/name.ext', function () {
      var result = references.getComponentName('/components/name.ext');

      expect(result).to.equal('name');
    });
  });

  describe('getComponentData', function () {
    it('basic case', function (done) {
      var data = {hey: 'hey'};

      sandbox.mock(files).expects('getComponentModule').returns(_.constant(bluebird.resolve(data)));

      references.getComponentData('/components/hey').done(function (result) {
        expect(result).to.equal(data);
        sandbox.verify();
        done();
      }, function (err) {
        done(err);
      });
    });
  });

  describe('putComponentData', function () {
    it('basic case', function (done) {
      var data = {hey: 'hey'};

      sandbox.mock(files).expects('getComponentModule').returns({put: _.constant(bluebird.resolve(data))});

      references.putComponentData('/components/hey').done(function (result) {
        expect(result).to.equal(data);
        sandbox.verify();
        done();
      }, function (err) {
        done(err);
      });
    });
  });

  describe('getPageData', function () {
    it('basic case', function (done) {
      var data = {},
        ref = '/pages/whatever';
      sandbox.mock(db).expects('get').withArgs(ref).returns(bluebird.resolve(JSON.stringify(data)));

      references.getPageData(ref).done(function (result) {
        sandbox.verify();
        expect(result).to.deep.equal(data);
        done();
      }, function (err) {
        done(err);
      });
    });
  });

  describe('putPageData', function () {
    it('basic case', function (done) {
      var data = {},
        ref = '/pages/whatever';
      sandbox.mock(db).expects('put').withArgs(ref, JSON.stringify(data)).returns(bluebird.resolve(data));

      references.putPageData(ref, data).done(function (result) {
        sandbox.verify();
        expect(result).to.equal(data);
        done();
      }, function (err) {
        done(err);
      });
    });
  });

  describe('getUriData', function () {
    it('basic case', function (done) {
      var data = 'thing',
        ref = '/uris/whatever';
      sandbox.mock(db).expects('get').withArgs(ref).returns(bluebird.resolve(data));

      references.getUriData(ref).done(function (result) {
        sandbox.verify();
        expect(result).to.equal(data);
        done();
      }, function (err) {
        done(err);
      });
    });
  });

  describe('putUriData', function () {
    it('basic case', function (done) {
      var data = 'thing',
        ref = '/uris/whatever';
      sandbox.mock(db).expects('put', data).withArgs(ref).returns(bluebird.resolve());

      references.putUriData(ref, data).done(function () {
        done();
      }, function (err) {
        done(err);
      });
    });
  });

  describe('getSchema', function () {
    it('basic case', function (done) {
      var data = {hey: 'hey'};

      sandbox.mock(files).expects('getComponentPath');
      sandbox.mock(schema).expects('getSchema').returns(bluebird.resolve(data));

      references.getSchema('/components/hey').done(function (result) {
        expect(result).to.equal(data);
        sandbox.verify();
        done();
      }, function (err) {
        done(err);
      });
    });
  });

  describe('getTemplate', function () {
    function stubTemplate(templateName) {
      sandbox.stub(files, 'getComponentPath').returns('asdf');
      sandbox.stub(glob, 'sync').returns([templateName]);
      sandbox.stub(config, 'get').returns('asdf');
    }

    it('throws error if no templates found', function () {
      sandbox.stub(glob, 'sync').returns([]);
      expect(function () {
        return references.getTemplate('');
      }).to.throw(Error);
    });

    it('gets a nunjucks template', function () {
      var result,
        reference = '/components/whatever',
        template = 'template.nunjucks';

      stubTemplate(template);

      result = references.getTemplate(reference);

      sandbox.verify();
      expect(result).to.eql(template);
    });

    it('gets a jade template', function () {
      var result,
        reference = '/components/whatever',
        template = 'template.jade';

      stubTemplate(template);

      result = references.getTemplate(reference);

      sandbox.verify();
      expect(result).to.eql(template);
    });

    it('gets a mustache template', function () {
      var result,
        reference = '/components/whatever',
        template = 'template.mustashe';

      stubTemplate(template);

      result = references.getTemplate(reference);

      sandbox.verify();
      expect(result).to.eql(template);
    });
  });
});