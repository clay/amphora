'use strict';

const _ = require('lodash'),
  filename = __filename.split('/').pop().split('.').shift(),
  Lib = require('./' + filename),
  expect = require('chai').expect,
  sinon = require('sinon');

describe(_.startCase(filename), function () {
  let sandbox;

  beforeEach(function () {
    sandbox = sinon.sandbox.create();
  });

  afterEach(function () {
    sandbox.restore();
  });

  describe('_transform', function () {
    it('errors if someone forces confusion', function () {
      const lib = new Lib({});

      lib.options.objectMode = false;
      lib.isArray = false;

      expect(function () {
        lib._transform('chuck', null, _.noop);
      }).to.throw();
    });
  });
});
