'use strict';
var mockFS = require('mock-fs'),
  expect = require('chai').expect,
  sinon = require('sinon'),
  fs = require('fs'),
  files = require('./files');

describe('files', function () {
  var mock, files, sandbox;

  before(function () {
    mock = mockFS.fs({
      components: {
        c1: {},
        c2: {}
      },
      sites: {
        site1: {},
        site2: {}
      },
      node_modules: { // jshint ignore:line
        c3: {},
        c4: {}
      }
    });
  });

  beforeEach(function () {
    sandbox = sinon.sandbox.create();
    // stub out fs methods
    sandbox.stub(fs, 'readdirSync', mock.readdirSync);
    sandbox.stub(fs, 'statSync', mock.statSync);
  });

  afterEach(function () {
    sandbox.restore();
  });

  after(function () {
    mockFS.restore();
  });

  // describe('getFolders()', function () {
  //   it('gets a list of folders', function () {
  //     expect(files.getFolders('.')).to.eql(['components', 'sites', 'node_modules']);
  //   });
  });

  // describe('getSites()', function () {
  //   var sandbox;

  //   beforeEach(function () {
  //     sandbox = sinon.sandbox.create();
  //   });

  //   afterEach(function () {
  //     sandbox.restore();
  //   });

  //   it('gets a list of folders', function () {
  //     sandbox.stub(fs, 'readFileSync')
  //   });
  // });

  // describe('getComponents()', function () {
  //   var sandbox;

  //   beforeEach(function () {
  //     sandbox = sinon.sandbox.create();
  //   });

  //   afterEach(function () {
  //     sandbox.restore();
  //   });

  //   it('gets a list of folders', function () {
  //     sandbox.stub(fs, 'readFileSync')
  //   });
  // });
});