'use strict';

const _ = require('lodash'),
  filename = __filename.split('/').pop().split('.').shift(),
  lib = require('./' + filename),
  bluebird = require('bluebird'),
  expect = require('chai').expect,
  sinon = require('sinon'),
  storage = require('../../test/fixtures/mocks/storage');

describe(_.startCase(filename), function () {
  let sandbox, db;

  beforeEach(function () {
    sandbox = sinon.sandbox.create();
    db = storage();
    lib.registerStorage(db);
  });

  afterEach(function () {
    sandbox.restore();
    return db.clearMem();
  });

  after(function () {
    return db.clearMem();
  });

  describe('list', function () {
    const fn = lib[this.title];

    it('default behaviour', function () {
      return bluebird.join(db.writeToInMem('1', '2'), db.writeToInMem('3', '4'), db.writeToInMem('5', '6'))
        .then(() => lib.pipeToPromise(fn()))
        .then(str => {
          expect(str).to.equal('{"1":"2","3":"4","5":"6"}');
        });
    });

    it('can get keys-only in array structure', function () {
      return bluebird.join(db.writeToInMem('1', '2'), db.writeToInMem('3', '4'), db.writeToInMem('5', '6'))
        .then(() => lib.pipeToPromise(fn({keys: true, values: false})))
        .then(str => {
          expect(str).to.equal('["1","3","5"]');
        });
    });

    it('can get values-only in array structure', function () {
      return bluebird.join(db.writeToInMem('1', '2'), db.writeToInMem('3', '4'), db.writeToInMem('5', '6'))
        .then(() => lib.pipeToPromise(fn({keys: false, values: true})))
        .then(str => {
          expect(str).to.equal('["2","4","6"]');
        });
    });

    it('can get key-value in object structure in array', function () {
      return bluebird.join(db.writeToInMem('1', '2'), db.writeToInMem('3', '4'), db.writeToInMem('5', '6'))
        .then(() => lib.pipeToPromise(fn({isArray: true})))
        .then(str => {
          expect(str).to.equal('[{"key":"1","value":"2"},{"key":"3","value":"4"},{"key":"5","value":"6"}]');
        });
    });

    it('can return empty data safely for arrays', function () {
      return lib.pipeToPromise(fn({isArray: true}))
        .then(str => {
          expect(str).to.equal('[]');
        });
    });

    it('can return empty data safely for objects', function () {
      return lib.pipeToPromise(fn({isArray: false})).then(function (str) {
        expect(str).to.equal('{}');
      });
    });

    it('can stream an object instead of a JSON string', function (done) {
      const onData = (data) => expect(data).to.deep.equal({key: '1', value: '2'}),
        onEnd = () => done(),
        onError = done;

      db.writeToInMem('1', '2')
        .then(() => {
          const pipe = fn({
            json: false
          });

          pipe.on('data', onData);
          pipe.on('end', onEnd);
          pipe.on('error', onError);
        });
    });
  });

  describe('getLatestData', function () {
    const fn = lib[this.title];

    it('grabs the latest data', function () {
      lib.get.returns(Promise.resolve());

      return fn('domain.com/_components/foo/instances/bar@published')
        .then(() => {
          sinon.assert.calledWith(lib.get, 'domain.com/_components/foo/instances/bar');
        });
    });
  });
});
