
'use strict';

const _ = require('lodash'),
  filename = __filename.split('/').pop().split('.').shift(),
  lib = require('./' + filename),
  sinon = require('sinon'),
  expect = require('chai').expect,
  storage = require('../../test/fixtures/mocks/storage');

describe(_.startCase(filename), function () {
  let sandbox, db;

  beforeEach(function () {
    sandbox = sinon.sandbox.create();

    db = storage();
    lib.setDb(db);
  });

  afterEach(function () {
    sandbox.restore();
  });

  describe('put', function () {
    const fn = lib[this.title],
      uri = 'domain.com/_lists/foo',
      fullList = [{
        id: 'bar'
      }, {
        id: 'baz'
      }];

    it('puts an individual item to a list', function () {
      db.put.returns(Promise.resolve());
      return fn(`${uri}/id`, {})
        .then(() => {
          sinon.assert.calledWith(db.put, `${uri}/id`, {});
        });
    });

    it('puts an array of items', function () {
      db.put.returns(Promise.resolve());

      return fn(uri, fullList)
        .then(() => {
          expect(db.put.firstCall.calledWith(`${uri}/bar`, fullList[0])).to.be.true;
          expect(db.put.secondCall.calledWith(`${uri}/baz`, fullList[1])).to.be.true;
        });
    });
  });

  describe('getAllLists', function () {
    const fn = lib[this.title];

    it('makes a call to retrieve all lists', function () {
      fn();
      sinon.assert.calledOnce(db.getLists);
    });
  });
});
