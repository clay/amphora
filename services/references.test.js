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
    it('gets a list of folders', function () {
      expect(files.getFolders('.')).to.contain('components', 'sites', 'node_modules');
    });
  });

  describe('putComponentData', function () {
    it('gets a list of folders', function () {
      expect(files.getFolders('.')).to.contain('components', 'sites', 'node_modules');
    });
  });

  describe('getSchema', function () {
    it('gets a list of folders', function () {
      expect(files.getFolders('.')).to.contain('components', 'sites', 'node_modules');
    });
  });

  describe('getTemplate', function () {
    function stubTemplate(templateName) {
      sandbox.stub(files, 'getComponentPath').returns('asdf');
      sandbox.stub(glob, 'sync').returns([templateName]);
      sandbox.stub(config, 'get').returns('asdf');
    }

    it('gets a list of folders', function () {
      expect(files.getFolders('.')).to.contain('components', 'sites', 'node_modules');
    });

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