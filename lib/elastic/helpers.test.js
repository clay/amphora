'use strict';
/* eslint max-nested-callbacks:[2,5] */

const sinon = require('sinon'),
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
      sandbox.stub(db, 'get');
      sandbox.stub(db, 'put');
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

      it('throws an exception if an op\'s value isn\'t a string', function () {
        let op = {
          type: 'put',
          key: 'www.vulture.com/components/article/instances/section-test',
          value: null
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

      it('returns the first property of an object inside of an array if the value is a string', function () {
        let value = [{ primaryHeadline: 'some headline', canonicalUrl: 'blahblahblah' }];

        expect(fn(value)).to.deep.equal(['some headline']);
      });

      it('returns the property inside of an array if the value is a string', function () {
        let value = ['some headline'];

        expect(fn(value)).to.deep.equal(['some headline']);
      });

      it('returns string array inside of faked array (object has "items" property)', function () {
        let value = { items: [{ text: 'hey' }] };

        expect(fn(value)).to.deep.equal(['hey']);
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

      it('normalizes op with string array mapping from ref', function () {

        db.get.returns(Promise.resolve(JSON.stringify({ b: 'hey' })));

        let op = [ { type: 'put',
            key: 'localhost.dev.nymag.biz/daily/intelligencer/components/article/instances/civzg5hje000kvurehqsgzcpy',
            value: {primaryHeadline: { _ref: 'b' }} } ],
          mapping = { dynamic: false,
            properties:
             { primaryHeadline: { type: 'string', index: 'analyzed' } },
            _timestamp: { enabled: true, store: 'yes' } },
          result = { primaryHeadline: 'hey' };

        fn(mapping, op).then(function (data) {
          expect(data).to.deep.equal(result);
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

      it('sets value to null if bad date type', function () {
        let op = [ { type: 'put',
            key: 'localhost.dev.nymag.biz/daily/intelligencer/components/article/instances/civzg5hje000kvurehqsgzcpy',
            value:
            { date: 123 } } ],
          mapping = { dynamic: false,
            properties:
             { date: { type: 'date', index: 'analyzed' } },
            _timestamp: { enabled: true, store: 'yes' } },
          result = {};

        fn(mapping, op).then(function (data) {
          expect(data).to.equal(result);
        });
      });

      it('does not invoke a comparitor if the type does not exist', function () {
        let op = [ { type: 'put',
            key: 'localhost/sitename/components/foo/instances/xyz',
            value:
            { primaryHeadline: 'Blaming Clinton’s Base for Her Loss' } } ],
          mapping = {properties:
             { primaryHeadline: { type: 'foo', index: 'analyzed' } },
            _timestamp: { enabled: true, store: 'yes' } },
          result = { primaryHeadline: 'Blaming Clinton’s Base for Her Loss' };

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

    describe('applyOpFilters', function () {
      let fn = lib[this.title],
        batchOps = [{
          type: 'put',
          key: 'localhost/components/foo/instances/xyz',
          value: { propertyName:'' }
        }],
        mappings = {
          myIndex: {
            general: {
              dynamic: false,
              properties: {
                propertyName: { type: 'string', index: 'analyzed' }
              }
            }
          }
        },
        indexName = 'myIndex',
        func = function (ops) {
          return ops;
        },
        expectedResp = [
          [{
            ops: batchOps,
            mapping: {
              dynamic: false,
              properties: {
                propertyName: { type: 'string', index: 'analyzed' }
              }
            },
            typeName: 'general'
          }]
        ];

      it('returns an operation without its refs', function () {
        return fn(batchOps, mappings, indexName, func)
          .then(function (resp) {
            expect(resp).to.deep.equal(expectedResp);
          });
      });
    });

    describe('resolveReferencesForPropertyOfStringType', function () {
      let fn = lib[this.title];

      it('removes an op if the value for the property is null or undefined', function () {
        let func = fn('content'),
          ops = [{
            type: 'put',
            key: 'localhost/components/foo/instances/xyz',
            value: { content: null }
          }, {
            type: 'put',
            key: 'localhost/components/foo/instances/qrx',
            value: { content: 'value' }
          }];

        return func(ops).then(function (resp) {
          expect(resp).to.deep.equal([{
            type: 'put',
            key: 'localhost/components/foo/instances/qrx',
            value: { content: 'value' }
          }]);
        });
      });
    });

    describe('convertOpValuesPropertyToDate', function () {
      let fn = lib[this.title];

      it('converts a string to a date', function () {
        let ops = [{ type: 'put',
          key: 'localhost/components/foo/instances/xyz',
          value: { date: 'Mon Nov 28 2016' }
        }];

        fn('date', ops);

        expect(ops[0].value.date).to.be.an.instanceof(Date);
      });

      it('does not a value that is already a date object', function () {
        let ops = [{ type: 'put',
          key: 'localhost/components/foo/instances/xyz',
          value: { date: new Date() }
        }];

        fn('date', ops);

        expect(ops[0].value.date).to.be.an.instanceof(Date);
      });

      it('sdfdsf', function () {
        let ops = [{ type: 'put',
          key: 'localhost/components/foo/instances/xyz',
          value: { date: null }
        }];

        fn('date', ops);

        expect(ops[0].value).to.deep.equal({});
      });
    });
  });
});
