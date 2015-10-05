'use strict';

var _ = require('lodash'),
  filename = __filename.split('/').pop().split('.').shift(),
  lib = require('./' + filename),
  sinon = require('sinon'),
  composer = require('./composer');

describe(_.startCase(filename), function () {
  var sandbox;

  beforeEach(function () {
    sandbox = sinon.sandbox.create();
    sandbox.stub(composer, 'addEngines');
  });

  afterEach(function () {
    sandbox.restore();
  });

  it('sets up', function () {
    return lib();
  });

  it('adds engines', function () {
    return lib({engines: 'whatever'}).then(function () {
      sinon.assert.calledOnce(composer.addEngines);
    });
  });
});