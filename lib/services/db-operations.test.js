'use strict';

const _ = require('lodash'),
  filename = __filename.split('/').pop().split('.').shift(),
  lib = require('./' + filename),
  sinon = require('sinon'),
  storage = require('../../test/fixtures/mocks/storage'),
  expect = require('chai').expect;

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

  describe('putDefaultBehavior', function () {
    const fn = lib[this.title],
      uri = 'domain.com/_components/foo/instances/bar';

    it('puts published data', function () {
      const result = fn(`${uri}@published`, {});

      expect(result).to.eql([{ type: 'put', key: `${uri}@published`, value: '{}'}]);
    });

    it('puts latest data', function () {
      const result = fn(uri, {});

      expect(result).to.eql([{ type: 'put', key: uri, value: '{}'}]);
    });

    it('puts published data', function () {
      const result = fn(`${uri}@foobar`, {});

      expect(result).to.eql([{ type: 'put', key: `${uri}@foobar`, value: '{}'}]);
    });
  });

  describe('getPutOperations', function () {
    const fn = lib[this.title],
      uri = 'domain.com/_components/foo/instances/foo',
      data = {
        foo: true,
        child: {
          _ref: 'domain.com/_components/foo/instances/bar',
          bar: true
        }
      };

    it('runs each data through the put function for a cmpt/layout', function () {
      const putFn = sandbox.stub();

      return fn(putFn, uri, data, {})
        .then(() => {
          sinon.assert.calledWith(putFn, uri, data, {});
        });
    });

    it('propagates @published versions', function () {
      const putFn = sandbox.stub();

      return fn(putFn, `${uri}@published`, data, {})
        .then(() => {
          sinon.assert.calledWith(putFn, `${uri}@published`, data, {});
        });
    });

    it('works without locals', function () {
      const putFn = sandbox.stub();

      return fn(putFn, uri, data)
        .then(() => {
          sinon.assert.calledWith(putFn, uri, data);
        });
    });
  });

  describe('cascadingPut', function () {
    const fn = lib[this.title],
      uri = 'domain.com/_components/foo/instances/foo',
      ops = [{
        key: 'domain.com/_components/foo/instances/child',
        value: '{}'
      }, {
        key: 'domain.com/_components/foo/instances/parent',
        value: '{"someVal":true}'
      }];

    it('sends ops to the db.batch function once generated', function () {
      sandbox.stub(lib, 'getPutOperations').returns(Promise.resolve(ops));
      db.batch.returns(Promise.resolve(ops));
      return fn()()
        .then(resp => {
          sinon.assert.calledWith(db.batch, ops);
          expect(resp).to.eql({someVal:true});
        });
    });

    it('throws an error if no ops are generated', function () {
      sandbox.stub(lib, 'getPutOperations').returns(Promise.resolve([]));
      db.batch.returns(Promise.resolve(ops));
      return fn()(uri)
        .catch(err => {
          expect(err.message).to.eql(`Component module PUT failed to create batch operations: ${uri}`);
        });
    });
  });
});
