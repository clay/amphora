'use strict';

const _ = require('lodash'),
  bluebird = require('bluebird'),
  expect = require('chai').expect,
  filename = __filename.split('/').pop().split('.').shift(),
  lib = require('./' + filename),
  sinon = require('sinon');

describe(_.startCase(filename), function () {
  let sandbox;

  beforeEach(function () {
    sandbox = sinon.createSandbox();
    sandbox.stub(lib, 'fetch');
  });

  afterEach(function () {
    sandbox.restore();
  });

  describe('getObject', function () {
    const fn = lib[this.title];

    it('gets', function () {
      lib.fetch.returns(bluebird.resolve({json: _.constant({})}));

      return fn('some-url');
    });
  });

  describe('putObject', function () {
    const fn = lib[this.title];

    it('puts', function () {
      lib.fetch.returns(bluebird.resolve());

      return fn('some-url');
    });
  });

  describe('fetch', function () {
    it('is the built-in fetch, looked up when called', function () {
      const original = global.fetch;

      sandbox.restore(); // brings back the real lib.fetch
      global.fetch = sinon.stub().returns('response');

      try {
        expect(lib.fetch('some-url', { method: 'POST' })).to.equal('response');
        sinon.assert.calledWith(global.fetch, 'some-url', { method: 'POST' });
      } finally {
        global.fetch = original;
      }
    });
  });
});
