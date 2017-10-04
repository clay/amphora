'use strict';

const _ = require('lodash'),
  bluebird = require('bluebird'),
  filename = __filename.split('/').pop().split('.').shift(),
  lib = require('./' + filename),
  sinon = require('sinon');

describe(_.startCase(filename), function () {
  let sandbox;

  beforeEach(function () {
    sandbox = sinon.sandbox.create();
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
});
