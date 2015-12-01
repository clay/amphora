'use strict';
var _ = require('lodash'),
  filename = __filename.split('/').pop().split('.').shift(),
  expect = require('chai').expect,
  sinon = require('sinon'),
  path = require('path'),
  lib = require('./' + filename);

describe(_.startCase(filename), function () {
  var sandbox;

  beforeEach(function () {
    sandbox = sinon.sandbox.create();
  });

  afterEach(function () {
    sandbox.restore();
  });

  describe('define', function () {
    const fn = lib[this.title];

    it('returns function even when given nothing', function () {
      const notify = fn();

      notify();
    });

    it('returns function when given empty array', function () {
      const definition = {
          webhooks: []
        },
        notify = fn(definition);

      notify();
    });

    it('returns function when given empty array', function () {
      const definition = {
          webhooks: [
            { url: 'some-url', event: 'event-name', op: 'put', match: 'some-regex' }
          ]
        },
        notify = fn(definition);

      notify();
    });
  });
});
