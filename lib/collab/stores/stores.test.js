'use strict';

// The same contract for both stores. The Redis one runs when
// CLAY_COLLAB_TEST_REDIS points at a disposable Redis (CI starts one); it
// flushes nothing, everything it writes is under a random key prefix.

const _ = require('lodash'),
  expect = require('chai').expect,
  MemoryStore = require('./memory'),
  RedisStore = require('./redis'),
  SITE = 'example.com',
  PAGE = `${SITE}/_pages/p1`,
  LAYOUT = `${SITE}/_layouts/l/instances/a`,
  CMPT = `${SITE}/_components/text/instances/a`,
  OPTIONS = { feedSize: 3, feedTtl: 60, revisionTtl: 60, presenceTtl: 1000 },
  STORES = [{ name: 'MemoryStore', create: now => new MemoryStore(_.assign({ now }, OPTIONS)) }];

if (process.env.CLAY_COLLAB_TEST_REDIS) {
  STORES.push({
    name: 'RedisStore',
    create: now => new RedisStore(_.assign({ now, redis: process.env.CLAY_COLLAB_TEST_REDIS, keyPrefix: `test:${Date.now()}:${Math.random()}` }, OPTIONS))
  });
}

STORES.forEach(({ name, create }) => {
  describe(`Collab ${name}`, function () {
    let store, now;

    this.timeout(5000);

    beforeEach(function () {
      now = 100000;
      store = create(() => now);
    });

    afterEach(function () {
      return store.close();
    });

    describe('revisions', function () {
      it('start at 0', function () {
        return store.revisions([CMPT, PAGE]).then(revs => expect(revs).to.eql({ [CMPT]: 0, [PAGE]: 0 }));
      });

      it('handle an empty list', function () {
        return store.revisions([]).then(revs => expect(revs).to.eql({}));
      });

      it('count up on unconditional writes', function () {
        return store.reserve(CMPT, null)
          .then(result => expect(result).to.eql({ ok: true, rev: 1, prev: 0 }))
          .then(() => store.reserve(CMPT, null))
          .then(result => expect(result).to.eql({ ok: true, rev: 2, prev: 1 }));
      });

      it('accept a write based on the current revision', function () {
        return store.reserve(CMPT, 0).then(result => expect(result.ok).to.equal(true));
      });

      it('reject a write based on another revision', function () {
        return store.reserve(CMPT, null)
          .then(() => store.reserve(CMPT, 0))
          .then(result => expect(result).to.eql({ ok: false, rev: 1, prev: 1 }))
          .then(() => store.revisions([CMPT]))
          .then(revs => expect(revs[CMPT]).to.equal(1));
      });

      it('only let one of two racing writes through', function () {
        return Promise.all([store.reserve(CMPT, 0), store.reserve(CMPT, 0)])
          .then(results => expect(_.map(results, 'ok').sort()).to.eql([false, true]));
      });

      it('release a reservation', function () {
        return store.reserve(CMPT, null)
          .then(() => store.reserve(CMPT, 1))
          .then(result => store.release(CMPT, result.rev, result.prev))
          .then(() => store.revisions([CMPT]))
          .then(revs => expect(revs[CMPT]).to.equal(1));
      });

      it('release the first revision back to nothing', function () {
        return store.reserve(CMPT, null)
          .then(result => store.release(CMPT, result.rev, result.prev))
          .then(() => store.revisions([CMPT]))
          .then(revs => expect(revs[CMPT]).to.equal(0));
      });

      it('do not release over a newer write', function () {
        return store.reserve(CMPT, null)
          .then(first => store.reserve(CMPT, null).then(() => store.release(CMPT, first.rev, first.prev)))
          .then(() => store.revisions([CMPT]))
          .then(revs => expect(revs[CMPT]).to.equal(2));
      });
    });

    describe('feeds', function () {
      it('start empty', function () {
        return store.cursor(SITE).then(cursor => expect(cursor).to.equal(0));
      });

      it('number events per site, across documents', function () {
        return store.append(SITE, PAGE, { type: 'save', uri: CMPT })
          .then(id => expect(id).to.equal(1))
          .then(() => store.append(SITE, LAYOUT, { type: 'save', uri: LAYOUT }))
          .then(id => expect(id).to.equal(2))
          .then(() => store.cursor(SITE))
          .then(cursor => expect(cursor).to.equal(2));
      });

      it('return events after a cursor, from every followed document', function () {
        return store.append(SITE, PAGE, { type: 'save', uri: CMPT, rev: 1 })
          .then(() => store.append(SITE, LAYOUT, { type: 'publish', uri: LAYOUT }))
          .then(() => store.append(SITE, `${SITE}/_pages/other`, { type: 'save', uri: 'x' }))
          .then(() => store.sync({ page: PAGE, docs: [PAGE, LAYOUT], session: 's1', entry: null, cursor: 0, presenceTtl: 1000 }))
          .then(({ events }) => {
            expect(_.sortBy(events, 'id')).to.eql([
              { id: 1, type: 'save', uri: CMPT, rev: 1 },
              { id: 2, type: 'publish', uri: LAYOUT }
            ]);
          })
          .then(() => store.sync({ page: PAGE, docs: [PAGE, LAYOUT], session: 's1', entry: null, cursor: 1, presenceTtl: 1000 }))
          .then(({ events }) => expect(_.map(events, 'id')).to.eql([2]));
      });

      it('keep only the newest events', function () {
        return Promise.all(_.times(5, i => store.append(SITE, PAGE, { type: 'save', uri: `${CMPT}${i}` })))
          .then(() => store.sync({ page: PAGE, docs: [PAGE], session: 's1', entry: null, cursor: 0, presenceTtl: 1000 }))
          .then(({ events }) => expect(_.map(events, 'id').sort()).to.eql([3, 4, 5]));
      });
    });

    describe('presence', function () {
      const entry = name => ({ session: name, user: { id: name, name }, focus: null, state: 'active' });

      it('shows everyone who synced recently', function () {
        return store.sync({ page: PAGE, docs: [PAGE], session: 'a', entry: entry('a'), cursor: 0, presenceTtl: 1000 })
          .then(() => store.sync({ page: PAGE, docs: [PAGE], session: 'b', entry: entry('b'), cursor: 0, presenceTtl: 1000 }))
          .then(({ presence }) => {
            expect(_.map(presence, 'session').sort()).to.eql(['a', 'b']);
            expect(presence[0].lastSeen).to.equal(now);
          });
      });

      it('updates an entry in place', function () {
        return store.sync({ page: PAGE, docs: [PAGE], session: 'a', entry: entry('a'), cursor: 0, presenceTtl: 1000 })
          .then(() => store.sync({ page: PAGE, docs: [PAGE], session: 'a', entry: _.assign(entry('a'), { state: 'idle' }), cursor: 0, presenceTtl: 1000 }))
          .then(({ presence }) => {
            expect(presence).to.have.length(1);
            expect(presence[0].state).to.equal('idle');
          });
      });

      it('drops entries older than the ttl', function () {
        return store.sync({ page: PAGE, docs: [PAGE], session: 'a', entry: entry('a'), cursor: 0, presenceTtl: 1000 })
          .then(() => { now += 1500; })
          .then(() => store.sync({ page: PAGE, docs: [PAGE], session: 'b', entry: entry('b'), cursor: 0, presenceTtl: 1000 }))
          .then(({ presence }) => expect(_.map(presence, 'session')).to.eql(['b']));
      });

      it('keeps pages separate', function () {
        return store.sync({ page: PAGE, docs: [PAGE], session: 'a', entry: entry('a'), cursor: 0, presenceTtl: 1000 })
          .then(() => store.sync({ page: `${SITE}/_pages/p2`, docs: [], session: 'b', entry: entry('b'), cursor: 0, presenceTtl: 1000 }))
          .then(({ presence }) => expect(_.map(presence, 'session')).to.eql(['b']));
      });

      it('removes a session that left', function () {
        return store.sync({ page: PAGE, docs: [PAGE], session: 'a', entry: entry('a'), cursor: 0, presenceTtl: 1000 })
          .then(() => store.leave(PAGE, 'a'))
          .then(() => store.sync({ page: PAGE, docs: [PAGE], session: 'b', entry: null, cursor: 0, presenceTtl: 1000 }))
          .then(({ presence }) => expect(presence).to.eql([]));
      });
    });
  });
});
