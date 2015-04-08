'use strict';
var expect = require('chai').expect,
  sinon = require('sinon'),
  glob = require('glob'),
  config = require('config'),
  composer = require('./composer'),
  files = require('./files'),
  db = require('./db'),
  bluebird = require('bluebird'),
  _ = require('lodash'),
  log = require('./log'),
  plex = require('multiplex-templates');

function createMockRes() {
  var res = {};
  res.status = _.constant(res);
  res.send = _.constant(res);
  res.locals = {site: 'someSite'};
  return res;
}

describe('Composer', function () {
  describe('getTemplate()', function () {
    var sandbox;

    beforeEach(function () {
      sandbox = sinon.sandbox.create();
      sandbox.stub(files, 'getComponentPath').returns('');
      sandbox.stub(config, 'get').returns('template');
    });

    afterEach(function () {
      sandbox.restore();
    });

    it('throws error if no templates found', function () {
      sandbox.stub(glob, 'sync').returns([]);
      expect(function () {
        return composer.getTemplate('');
      }).to.throw(Error);
    });

    it('gets a nunjucks template', function () {
      sandbox.stub(glob, 'sync').returns(['template.nunjucks']);
      expect(composer.getTemplate('')).to.eql('template.nunjucks');
    });

    it('gets a jade template', function () {
      sandbox.stub(glob, 'sync').returns(['template.jade']);
      expect(composer.getTemplate('')).to.eql('template.jade');
    });

    it('gets a mustache template', function () {
      sandbox.stub(glob, 'sync').returns(['template.mustache']);
      expect(composer.getTemplate('')).to.eql('template.mustache');
    });

    it('getTemplate basic case', function () {
      sandbox.stub(glob, 'sync').returns(['template.mustache']);
      composer.getTemplate('');
    });

    it('renderComponent basic case', function (done) {
      sandbox.stub(log, 'info', _.noop);
      sandbox.stub(db, 'get').returns(bluebird.delay(JSON.stringify({}), 0));
      var mockRes = createMockRes();
      composer.renderComponent('', mockRes).then(function () {
        done();
      });
    });

    it('renderComponent data not found', function (done) {
      sandbox.stub(log, 'info', _.noop);
      sandbox.stub(db, 'get').returns(bluebird.delay(JSON.stringify({a: 'b', c: {d: 'e'}}), 0));
      var mockRes = createMockRes();

      sandbox.mock(mockRes).expects('send').once().withArgs('404 Not Found');

      composer.renderComponent('', mockRes).then(function () {
        sandbox.verify();
        done();
      });
    });

    it('renderComponent data found', function (done) {
      sandbox.stub(log, 'info', _.noop);
      sandbox.stub(db, 'get').returns(bluebird.delay(JSON.stringify({site: 'Hey', baseTemplate: 'Hey'}), 0));
      sandbox.stub(glob, 'sync').returns(['template.jade']);
      sandbox.stub(plex, 'render').returns('asdf');
      var mockRes = createMockRes();

      sandbox.mock(mockRes).expects('send').once().withArgs('asdf');

      composer.renderComponent('', mockRes).then(function () {
        sandbox.verify();
        done();
      });
    });

    it('renderComponent option: ignore-data ignores baseTemplate from data', function (done) {
      var mockRes = createMockRes(),
        someGoodComponentName = 'someGoodComponentName',
        someGoodComponentReference = '/components/' + someGoodComponentName,
        someBadComponentName = '/components/someBadComponentName';
      sandbox.stub(log, 'info', _.noop);
      sandbox.stub(db, 'get').returns(bluebird.delay(JSON.stringify({site: 'Hey', baseTemplate: someBadComponentName}), 0));
      sandbox.stub(glob, 'sync').returns(['template.jade']);

      sandbox.mock(plex).expects('render').withArgs(sinon.match.string, sinon.match({baseTemplate: someGoodComponentName})).returns('asdf');
      sandbox.mock(mockRes).expects('send').once().withArgs('asdf');

      composer.renderComponent(someGoodComponentReference, mockRes, {'ignore-data': 'baseTemplate'}).then(function () {
        sandbox.verify();
        done();
      });
    });
  });
});