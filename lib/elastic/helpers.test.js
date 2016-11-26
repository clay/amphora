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
        let value = { primaryHeadline: 'some headline' };

        expect(fn(value)).to.equal('some headline');
      });

      it('throws an exception if the value is a bad string or [string] type', function () {
        let value = 123;

        expect(fn(value)).to.throw;
      });

      it('throws an exception if the array value is a bad string or [string] type', function () {
        let value = [['blah blah']];

        expect(fn(value)).to.throw;
      });
    });

/*    describe('applyOpFilters', function () {
      let fn = lib[this.title];

      it('batches op and applies filters to it', function () {
        return fn(ops, mapping, index, fn).then(function () {
          // blah blah
        });
      });
*/
    describe('normalizeOpValuesWithMapping', function () {
      let fn = lib[this.title];

      it('normalizes op with string type', function () {
        let op = [ { type: 'put',
            key: 'localhost.dev.nymag.biz/daily/intelligencer/components/article/instances/civzg5hje000kvurehqsgzcpy',
            value:
            { primaryHeadline: 'Blaming Clinton’s Base for Her Loss' } } ],
          mapping = { dynamic: false,
            properties:
             { primaryHeadline: { type: 'string', index: 'analyzed' } },
            _timestamp: { enabled: true, store: 'yes' } },
          result = { primaryHeadline: 'Blaming Clinton’s Base for Her Loss' };

        fn(mapping, op).then(function (data) {
          expect(data).to.equal(result);
        });
      });

      it('normalizes op with object type', function () {
        let op = [ { type: 'put',
            key: 'localhost.dev.nymag.biz/daily/intelligencer/components/article/instances/civzg5hje000kvurehqsgzcpy',
            value: {feeds: {sitemaps: true, rss: true, newsfeed: true} }} ],
          mapping = { dynamic: false,
            properties:
             { feeds: { type: 'object', index: 'analyzed' } },
            _timestamp: { enabled: true, store: 'yes' } },
          result = [ { type: 'put',
            key: 'localhost.dev.nymag.biz/daily/intelligencer/components/article/instances/civzg5hje000kvurehqsgzcpy',
            value: {feeds: {sitemaps: true, rss: true, newsfeed: true} }} ];

        fn(mapping, op).then(function (data) {
          expect(data).to.equal(result);
        });
      });

      it('normalizes op with date type', function () {
        let op = [ { type: 'put',
            key: 'localhost.dev.nymag.biz/daily/intelligencer/components/article/instances/civzg5hje000kvurehqsgzcpy',
            value:
            { date: '2016-11-20' } } ],
          mapping = { dynamic: false,
            properties:
             { date: { type: 'date', index: 'analyzed' } },
            _timestamp: { enabled: true, store: 'yes' } },
          result = { date: new Date('2016-11-20') };

        fn(mapping, op).then(function (data) {
          expect(data).to.equal(result);
        });
      });
    });

    describe('removeAllReferences', function () {
      let fn = lib[this.title];

      it('returns an operation without its refs', function () {
        let op = {
          type: 'put',
          key: 'www.vulture.com/components/article/instances/section-test',
          value: { _ref: 'localhost.dev.nymag.biz/daily/intelligencer/components/clay-paragraph/instances/civv4lklw000jjzp43yqr0a2n' }
        };

        expect(fn(op)).to.deep.equal({
          type: 'put',
          key: 'www.vulture.com/components/article/instances/section-test',
          value: {}
        });
      });
    });
  });
});
