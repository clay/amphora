'use strict';
const _ = require('lodash'),
  bluebird = require('bluebird'),
  db = require('./db'),
  uid = require('../uid'),
  filename = __filename.split('/').pop().split('.').shift(),
  expect = require('chai').expect,
  sinon = require('sinon'),
  lib = require('./' + filename),
  fakeUID = 'a1b2c3',
  baseUri = 'domain.com/users',
  uri = baseUri + '/' + fakeUID;

describe(_.startCase(filename), function () {
  let sandbox;

  beforeEach(function () {
    sandbox = sinon.sandbox.create();
    sandbox.stub(uid, 'get').returns(fakeUID);
    sandbox.stub(db, 'put');
  });

  afterEach(function () {
    sandbox.restore();
  });

  describe('post', function () {
    const fn = lib[this.title];

    it('creates a user', function () {
      const data = {
        username: 'bar',
        provider: 'twitter'
      };

      db.put.returns(bluebird.resolve());

      return fn(baseUri, _.clone(data)).then(function (result) {
        expect(db.put.calledWith(uri, JSON.stringify(data))).to.equal(true);
        expect(result).to.deep.equal(_.assign(data, { _ref: uri }));
      });
    });
  });
});
