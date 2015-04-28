'use strict';

var _ = require('lodash'),
  filename = _.startCase(__filename.split('/').pop().split('.').shift()),
  schema = require('./schema'),
  db = require('./db'),
  expect = require('chai').expect,
  sinon = require('sinon'),
  bluebird = require('bluebird');

describe(filename, function () {
  var sandbox;

  beforeEach(function () {
    sandbox = sinon.sandbox.create();
  });

  afterEach(function () {
    sandbox.restore();
  });

  it('read basic schema', function () {
    var textSchema = schema.getSchema('test/fixtures/text');

    expect(textSchema).to.deep.equal({
      name: {
        _type: 'text',
        _required: true
      },
      areas: {
        body: {
          _type: 'component-list'
        }
      }
    });
  });

  describe('resolveDataReferences', function () {
    it('looks up references', function (done) {
      var mock,
        data = {
          a: {_ref:'b'},
          c: {d: {_ref:'e'}}
        };

      mock = sandbox.mock(db);
      mock.expects('get').withArgs('b').once().returns(bluebird.resolve(JSON.stringify({g: 'h'})));
      mock.expects('get').withArgs('e').once().returns(bluebird.resolve(JSON.stringify({i: 'j'})));

      schema.resolveDataReferences(data).done(function (result) {
        sandbox.verify();
        expect(result).to.deep.equal({
          a: { _ref: 'b', g: 'h' },
          c: { d: { _ref: 'e', i: 'j' } }
        });
        done();
      });
    });

    it('looks up references recursively', function (done) {
      var mock,
        data = {
          a: {_ref:'b'},
          c: {d: {_ref:'e'}}
        };

      mock = sandbox.mock(db);
      mock.expects('get').withArgs('b').once().returns(bluebird.resolve(JSON.stringify({g: 'h'})));
      mock.expects('get').withArgs('e').once().returns(bluebird.resolve(JSON.stringify({i: 'j', 'k': {_ref:'m'}})));
      mock.expects('get').withArgs('m').once().returns(bluebird.resolve(JSON.stringify({n: 'o'})));

      schema.resolveDataReferences(data).done(function (result) {
        sandbox.verify();
        expect(result).to.deep.equal({
          a: { _ref: 'b', g: 'h' },
          c: { d: {
            _ref: 'e',
            i: 'j',
            k: {
              _ref: 'm',
              n: 'o' //we just recursively looked this up from another lookup
            }
          } }
        });
        done();
      });
    });
  });
});