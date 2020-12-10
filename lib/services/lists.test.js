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

  describe('patchList', function () {
    const fn = lib.patchList;

    it('will throw if bad request body', function () {
      try {
        fn('domain.com/_lists/test', {});
      } catch (e) {
        expect(e.message).to.eql('Bad Request. List PATCH requires `add` or `remove` to be an array.');
      }
    });

    it('adds to existing lists if has add property', function () {
      db.get.resolves([]);
      db.put.callsFake((uri, list) => Promise.resolve({ _value: list }));

      return fn('domain.com/_lists/test', { add: [ 'hello' ] }).then(list => {
        expect(list).to.eql([ 'hello' ]);
      });
    });

    it('removes from existing lists if has remove property', function () {
      db.get.resolves([ 'hello' ]);
      db.put.callsFake((uri, list) => Promise.resolve({ _value: list }));

      return fn('domain.com/_lists/test', { remove: [ 'hello' ] }).then(list => {
        expect(list).to.eql([]);
      });
    });

    it('throws if object to remove does not exist', function () {
      db.get.resolves([ 'hello' ]);

      return fn('domain.com/_lists/test', { remove: [ 'world' ]})
        .catch(e => {
          expect(e.message).to.eql('Nothing was removed from the list.');
        });
    });
  });
});
