'use strict';

const _ = require('lodash'),
  filename = __filename.split('/').pop().split('.').shift(),
  lib = require('./' + filename),
  sinon = require('sinon'),
  expect = require('chai').expect,
  Redis = require('ioredis');

/**
 * Require a pristine copy of the module under test.
 *
 * `connect` sets a module-level flag that decides which branch of `publish` runs, and the module is
 * cached, so one test calling `connect` would otherwise decide that branch for every later test in
 * this file and in every other file holding the same cached copy. Tests that care about a specific
 * branch take their own. The shared instance that `pages` and `db-operations` already reference is
 * left untouched.
 *
 * @returns {Object}
 */
function freshBus() {
  const resolved = require.resolve('./' + filename),
    cached = require.cache[resolved];
  let fresh;

  delete require.cache[resolved];
  fresh = require('./' + filename);
  require.cache[resolved] = cached;

  return fresh;
}

describe(_.startCase(filename), function () {
  var sandbox, publish, fakeLog;

  beforeEach(function () {
    sandbox = sinon.sandbox.create();
    sandbox.stub(Redis.prototype, 'connect');
    publish = sandbox.stub();
    fakeLog = sandbox.stub();
    lib.client = { publish };
    lib.setLog(fakeLog);
  });

  afterEach(function () {
    sandbox.restore();
    // Restore the module singleton's client to its documented default so a
    // fake/rejecting client set by one test (esp. via `connect`, which isn't
    // sandbox-managed) can't leak into other test files that require this
    // same cached module and call the real `bus.publish`.
    lib.client = undefined;
  });

  describe('connect', function () {
    const fn = lib[this.title];

    it('calls the internal `connect` method for the ioredis Redis Client', function () {
      Redis.prototype.connect.resolves(true);
      fn();
      sinon.assert.calledOnce(Redis.prototype.connect);
    });
  });

  describe('publish', function () {
    const fn = lib[this.title],
      testObj = { foo: 'bar' };

    it('throws an error if topic and message are not defined', function () {
      expect(fn).to.throw();
    });

    it('throws an error if topic is not a string', function () {
      expect(() => fn(1, 'foo')).to.throw();
    });

    it('throws an error if message is not defined', function () {
      expect(() => fn('foo', 1)).to.throw();
    });

    it('calls the publish function if topic and message pass validation', function () {
      fn('foo', testObj);
      sinon.assert.calledOnce(publish);
    });

    it('does not call publish if no client is defined', function () {
      lib.client = false;
      fn('foo', testObj);
      sinon.assert.notCalled(publish);
    });

    it('accepts a bus module passed into the connect method', function () {
      const fakePub = sandbox.spy(),
        fakeBus = { connect: () => ({ publish: fakePub })};

      lib.connect(fakeBus);
      fn('foo', testObj);
      sinon.assert.calledOnce(fakePub);
    });

    it('returns a Promise', function () {
      const result = fn('foo', testObj);

      expect(result).to.be.an.instanceOf(Promise);
    });

    it('resolves (with no value) when no client is defined', function () {
      lib.client = false;

      return fn('foo', testObj);
    });

    it('returns a bus module client\'s Promise so callers can wait on it', function () {
      const fresh = freshBus(),
        fakePub = sandbox.stub().resolves(1),
        fakeBus = { connect: () => ({ publish: fakePub })};

      fresh.connect(fakeBus);

      return fresh.publish('foo', testObj).then(result => {
        // a bus module is handed the message itself, it does its own serializing
        sinon.assert.calledWith(fakePub, sinon.match(/:foo$/), testObj);
        expect(result).to.equal(1);
      });
    });

    it('propagates rejections from a bus module client', function () {
      const fresh = freshBus(),
        testError = new Error('bus module is down'),
        fakePub = sandbox.stub().rejects(testError),
        fakeBus = { connect: () => ({ publish: fakePub })};

      fresh.connect(fakeBus);

      return fresh.publish('foo', testObj).then(
        () => { throw new Error('expected promise to reject'); },
        err => expect(err).to.equal(testError)
      );
    });

    // Reconnecting without a module used to leave the injected-bus flag set, so `publish` kept
    // taking the injected path against a raw ioredis client: adopting its rejections, and handing
    // it an object where it expects a string.
    it('reverts to default-client semantics when reconnected without a bus module', function () {
      const fresh = freshBus(),
        injected = { connect: () => ({ publish: sandbox.stub().resolves('injected') }) },
        fakePub = sandbox.stub().rejects(new Error('redis is down'));
      let published;

      // the ioredis constructor chains on its own connect(), which the sandbox stubs
      Redis.prototype.connect.resolves(true);
      fresh.connect(injected);
      fresh.connect();
      fresh.client = { publish: fakePub };
      published = fresh.publish('foo', testObj);
      fakePub.firstCall.returnValue.catch(_.noop);

      return published.then(result => {
        sinon.assert.calledWith(fakePub, sinon.match(/:foo$/), JSON.stringify(testObj));
        expect(result).to.equal(undefined);
      });
    });

    // The deliberate inverse of the test above: the default client stays
    // fire-and-forget so that a Redis failure can't fail a save that has already
    // been committed to the database. See `publish` in lib/services/bus.js.
    it('does not surface rejections from the default Redis client', function () {
      const fresh = freshBus(),
        fakePub = sandbox.stub().rejects(new Error('redis is down'));
      let published;

      fresh.client = { publish: fakePub };
      published = fresh.publish('foo', testObj);
      // `publish` drops this Promise on purpose; keep a handler on it so the
      // ignored rejection doesn't take down the test process
      fakePub.firstCall.returnValue.catch(_.noop);

      return published.then(result => {
        // unlike a bus module, the default client is handed a serialized message
        sinon.assert.calledWith(fakePub, sinon.match(/:foo$/), JSON.stringify(testObj));
        expect(result).to.equal(undefined);
      });
    });
  });
});
