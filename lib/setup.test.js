'use strict';

const _ = require('lodash'),
  filename = __filename.split('/').pop().split('.').shift(),
  lib = require('./' + filename),
  sinon = require('sinon'),
  htmlComposer = require('./html-composer'),
  search = require('./services/search');

describe(_.startCase(filename), function () {
  let sandbox;

  beforeEach(function () {
    sandbox = sinon.sandbox.create();
    sandbox.stub(htmlComposer, 'addEngines');
    sandbox.stub(search, 'setup');
  });

  afterEach(function () {
    sandbox.restore();
  });

  it('sets up', function () {
    return lib();
  });

  it('adds engines', function () {
    return lib({engines: 'whatever'}).then(function () {
      sinon.assert.calledOnce(search.setup);
      sinon.assert.calledOnce(htmlComposer.addEngines);
    });
  });
});
