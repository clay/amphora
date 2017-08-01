'use strict';
const _ = require('lodash'),
  bluebird = require('bluebird'),
  db = require('./db'),
  filename = __filename.split('/').pop().split('.').shift(),
  expect = require('chai').expect,
  sinon = require('sinon'),
  lib = require('./' + filename),
  buf = require('./buffer'),
  baseUri = 'domain.com/users';

describe(_.startCase(filename), function () {
  let sandbox;

  beforeEach(function () {
    sandbox = sinon.sandbox.create();
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
        },
        uri = baseUri + '/' + lib.encode(data.username, data.provider);

      db.put.returns(bluebird.resolve());

      return fn(baseUri, _.clone(data)).then(function (result) {
        expect(db.put.calledWith(uri, JSON.stringify(data))).to.equal(true);
        expect(result).to.deep.equal(_.assign(data, { _ref: uri }));
      });
    });
  });

  describe('encode', function () {
    const fn = lib[this.title];

    it('encodes username and provider', function () {
      expect(fn('foo', 'bar')).to.equal(buf.encode('foo@bar'));
    });
  });

});
