'use strict';
/* eslint max-nested-callbacks:[2,5] */

var _ = require('lodash'),
  promise = require('bluebird'),
  expect = require('chai').expect,
  filename = __filename.split('/').pop().split('.').shift(),
  lib = require('./' + filename);

describe(_.startCase(filename), function () {
  var resp = lib();

  it('returns an object with three properties', function () {
    expect(_.size(resp)).to.equal(3);
  });

  it('return object has a `resolve` property', function () {
    expect(_.get(resp, 'resolve')).to.be.function;
  });

  it('return object has a `reject` property', function () {
    expect(_.get(resp, 'reject')).to.be.function;
  });

  it('return object has a `promise` property', function () {
    expect(_.get(resp, 'promise')).to.be.an.instanceof(promise);
  });
});
