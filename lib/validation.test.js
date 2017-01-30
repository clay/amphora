'use strict';

const _ = require('lodash'),
  filename = __filename.split('/').pop().split('.').shift(),
  lib = require('./' + filename),
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

  describe('assertValidValue', function () {
    const fn = lib[this.title];

    it('does not throw error on valid put data', function () {
      const type = 'put',
        value = '{}';

      expect(function () {
        fn(type, value);
      }).to.not.throw();
    });

    it('does not throw error on valid del data', function () {
      const type = 'del';

      expect(function () {
        fn(type);
      }).to.not.throw();
    });

    it('throws error on missing put data', function () {
      const type = 'put';

      expect(function () {
        fn(type);
      }).to.throw('Invalid put value: Missing value in batch operation');
    });

    it('throws error on missing put data', function () {
      const type = 'put',
        value = JSON.stringify(JSON.stringify({}));

      expect(function () {
        fn(type, value);
      }).to.throw('Invalid put value: Double-stringified value in batch operation');
    });
  });

  describe('assertValidBatchOps', function () {
    const fn = lib[this.title];

    it('does not throw with no errors', function () {
      const ops = [
        { type: 'a', key: 'b', value: 'c' },
        { type: 'd', key: 'e', value: 'f' }
      ];

      expect(function () {
        fn(ops);
      }).to.not.throw(Error);
    });

    it('throws with errors', function () {
      const ops = [
        { key: 'b', value: 'c' },
        { type: 'd', value: 'f' }
      ];

      expect(function () {
        fn(ops);
      }).to.throw(Error);
    });
  });

  describe('validateBatchOps', function () {
    const fn = lib[this.title];

    it('get multiple errors', function () {
      const ops = [
          { key: 'b', value: 'c' },
          { type: 'd', value: 'f' }
        ],
        errors = [
          'Missing type in batch operation, can be "put" or "del"',
          'Missing key in batch operation'
        ];

      expect(fn(ops)).to.deep.equal(errors);
    });
  });

  describe('validateBatchOp', function () {
    const fn = lib[this.title];

    it('returns empty array when no errors', function () {
      const op = {
          type: 'a',
          key: 'b',
          value: 'c'
        },
        errors = [];

      expect(fn(op)).to.deep.equal(errors);
    });

    it('returns error when missing type', function () {
      const op = {
          key: 'b',
          value: 'c'
        },
        errors = ['Missing type in batch operation, can be "put" or "del"'];

      expect(fn(op)).to.deep.equal(errors);
    });

    it('returns error when missing key', function () {
      const op = {
          type: 'a',
          value: 'c'
        },
        errors = ['Missing key in batch operation'];

      expect(fn(op)).to.deep.equal(errors);
    });

    it('returns error when missing value', function () {
      const op = {
          type: 'a',
          key: 'b'
        },
        errors = ['Missing value in batch operation for type a'];

      expect(fn(op)).to.deep.equal(errors);
    });

    it('does not return error when missing value but type is "del"', function () {
      const op = {
          type: 'del',
          key: 'b'
        },
        errors = [];

      expect(fn(op)).to.deep.equal(errors);
    });

    it('returns empty array when no errors', function () {
      const op = {
          type: 'a',
          key: 'b',
          value: JSON.stringify('c')
        },
        errors = ['Double-stringified value in batch operation'];

      expect(fn(op)).to.deep.equal(errors);
    });
  });
});
