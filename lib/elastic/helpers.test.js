'use strict';

const bluebird = require('bluebird'),
  sinon = require('sinon'),
  _ = require('lodash'),
  expect = require('chai').expect,
  filename = __filename.split('/').pop().split('.').shift(),
  lib = require('./' + filename),
  db = require('../services/db');

describe(_.startCase(filename), function () {
  describe(filename, function () {
    var sandbox;

    beforeEach(function () {
      sandbox = sinon.sandbox.create();
      sandbox.stub(db);
      db.get.returns(bluebird.resolve(null));
    });

    afterEach(function () {
      sandbox.restore();
    });

    describe('parseOpValue', function () {
      let fn = lib[this.title];

      it('throws an exception if an op\'s value isn\'t an object', function () {
        let op = {
          type: 'put',
          key: 'www.vulture.com/components/article/instances/section-test',
          value: 'this is a string'
        };

        expect(fn(op)).to.throw;
      });
    });

    describe('convertObjectToString', function () {
      let fn = lib[this.title];

      it('returns the first property of an object if the property value is a string', function () {
        let value = { primaryHeadline: 'some headline', content: [], tags: {}, sideShare: {}, section: 'some-section', slug: 'some-slug' };

        expect(fn(value)).to.equal('some headline');
      });

      it('returns the first property of an object inside of an array if the property value is a string', function () {
        let value = [{ primaryHeadline: 'some headline', content: [], tags: {}, sideShare: {}, section: 'some-section', slug: 'some-slug' }];

        expect(fn(value)).to.equal('some headline');
      });

      it('returns the value inside of an array if the value is a string', function () {
        let value = ['this is a string'];

        expect(fn(value)).to.equal('this is a string');
      });

      it('throws an exception if the value is a bad string or [string] type', function () {
        let value = 123;

        expect(fn(value)).to.throw;
      });

      it('throws an exception if the array value is a bad string or [string] type', function () {
        let value = [['blah blah']];

        expect(fn(value)).to.throw;
      });


      it('passes back in the object if it\'s actually an array with properties' , function () {
        let value = { items: ['test1', 'test2', 'test3'] };

        expect(fn(value)).to.equal('test1');
      });

      it('returns the value inside of an array if the value is a string', function () {
        let value = ['this is a string'];

        expect(fn(value)).to.equal('this is a string');
      });

    });
  });
});
