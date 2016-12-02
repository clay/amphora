'use strict';

const _ = require('lodash'),
  filename = __filename.split('/').pop().split('.').shift(),
  lib = require('./' + filename),
  sinon = require('sinon'),
  htmlComposer = require('./html-composer');

describe(_.startCase(filename), function () {
  let sandbox;

  beforeEach(function () {
    sandbox = sinon.sandbox.create();
    sandbox.stub(htmlComposer, 'addEngines');
  });

  afterEach(function () {
    sandbox.restore();
  });

  it('sets up', function () {
    return lib();
  });

  it('adds engines', function () {
    return lib({engines: 'whatever'}).then(function () {
      sinon.assert.calledOnce(htmlComposer.addEngines);
    });
  });
});