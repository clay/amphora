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
  OPTIONS = { feedSize: 3, feedTtl: 60, revisionTtl: 60, lockTtl: 1000, hiddenPresenceTtl: 5000 },
  STORES = [{ name: 'MemoryStore', create: now => new MemoryStore(_.assign({ now }, OPTIONS)) }];

if (process.env.CLAY_COLLAB_TEST_REDIS) {
  STORES.push({
    name: 'RedisStore',
    create: now => new RedisStore(_.assign({ now, redis: process.env.CLAY_COLLAB_TEST_REDIS, keyPrefix: `test:${Date.now()}:${Math.random()}` }, OPTIONS))
  });
}

/**
 * The contract every store has to meet.
 * @param {object} options
 * @param {string} options.name
 * @param {function} options.create (now) => store
 */
function contract({ name, create }) {
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

      it('only show a new revision once its write is committed', function () {
        return store.reserve(CMPT, null, 't1')
          .then(result => expect(result).to.eql({ ok: true, busy: false, rev: 1, prev: 0 }))
          .then(() => store.revisions([CMPT]))
          .then(revs => expect(revs[CMPT]).to.equal(0))
          .then(() => store.commit(CMPT, 't1', 1))
          .then(() => store.revisions([CMPT]))
          .then(revs => expect(revs[CMPT]).to.equal(1));
      });

      it('make a second write wait while one is in flight', function () {
        return store.reserve(CMPT, 0, 't1')
          .then(() => store.reserve(CMPT, 0, 't2'))
          .then(result => expect(result.busy).to.equal(true))
          .then(() => store.commit(CMPT, 't1', 1))
          .then(() => store.reserve(CMPT, 0, 't2'))
          .then(result => expect(result).to.eql({ ok: false, busy: false, rev: 1, prev: 1 }));
      });

      it('accept a write based on the committed revision', function () {
        return store.reserve(CMPT, 0, 't1').then(result => expect(result.ok).to.equal(true));
      });

      it('always send -1 (unknown revision) back for merging', function () {
        return store.reserve(CMPT, -1, 't1').then(result => expect(result).to.eql({ ok: false, busy: false, rev: 0, prev: 0 }));
      });

      it('let only one of two racing writes through', function () {
        return Promise.all([store.reserve(CMPT, 0, 't1'), store.reserve(CMPT, 0, 't2')])
          .then(results => expect(_.map(results, 'ok').sort()).to.eql([false, true]));
      });

      it('release a failed write without changing the revision', function () {
        return store.reserve(CMPT, null, 't1')
          .then(() => store.release(CMPT, 't1'))
          .then(() => store.revisions([CMPT]))
          .then(revs => expect(revs[CMPT]).to.equal(0))
          .then(() => store.reserve(CMPT, 0, 't2'))
          .then(result => expect(result.ok).to.equal(true));
      });

      it('ignore a release from another write', function () {
        return store.reserve(CMPT, null, 't1')
          .then(() => store.release(CMPT, 'someone-else'))
          .then(() => store.reserve(CMPT, null, 't2'))
          .then(result => expect(result.busy).to.equal(true));
      });

      it('free a uri whose write never finished', function () {
        return store.reserve(CMPT, null, 't1')
          .then(() => new Promise(resolve => setTimeout(resolve, 1100))) // lockTtl is 1s
          .then(() => { now += 1100; })
          .then(() => store.reserve(CMPT, null, 't2'))
          .then(result => expect(result.ok).to.equal(true));
      });

      it('move a revision forward without a check', function () {
        return store.bump(CMPT)
          .then(rev => expect(rev).to.equal(1))
          .then(() => store.bump(CMPT))
          .then(rev => expect(rev).to.equal(2));
      });

      it('never move a revision backwards on commit', function () {
        return store.bump(CMPT).then(() => store.bump(CMPT))
          .then(() => store.commit(CMPT, 'late', 1))
          .then(() => store.revisions([CMPT]))
          .then(revs => expect(revs[CMPT]).to.equal(2));
      });
    });

    describe('shared values', function () {
      it('keep a stable epoch and salt', function () {
        return Promise.all([store.epoch(), store.epoch(), store.salt(), store.salt()])
          .then(([a, b, c, d]) => {
            expect(a).to.be.a('string').and.equal(b);
            expect(c).to.be.a('string').and.equal(d);
            expect(a).not.to.equal(c);
          });
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
          .then(() => store.sync({ page: PAGE, docs: [PAGE, LAYOUT], key: 'k1', entry: null, cursor: 0 }))
          .then(({ events, start }) => {
            expect(_.sortBy(events, 'id')).to.eql([
              { id: 1, type: 'save', uri: CMPT, rev: 1 },
              { id: 2, type: 'publish', uri: LAYOUT }
            ]);
            expect(start).to.equal(0);
          })
          .then(() => store.sync({ page: PAGE, docs: [PAGE, LAYOUT], key: 'k1', entry: null, cursor: 1 }))
          .then(({ events }) => expect(_.map(events, 'id')).to.eql([2]));
      });

      it('keep only the newest events, and say where they start', function () {
        const appendOne = i => store.append(SITE, PAGE, { type: 'save', uri: `${CMPT}${i}` });

        return Promise.all(_.times(5, appendOne))
          .then(() => store.sync({ page: PAGE, docs: [PAGE], key: 'k1', entry: null, cursor: 0 }))
          .then(({ events, start }) => {
            expect(_.map(events, 'id').sort()).to.eql([3, 4, 5]);
            expect(start).to.equal(3);
          });
      });
    });

    describe('presence', function () {
      const entry = name => ({ user: { id: name, name }, focus: null, state: 'active' }),
        join = (key, expires) => store.sync({ page: PAGE, docs: [PAGE], key, entry: entry(key), expires: expires || now + 1000, cursor: 0 });

      it('shows everyone who synced recently, with their keys', function () {
        return join('a')
          .then(() => join('b'))
          .then(({ presence }) => {
            expect(_.map(presence, 'key').sort()).to.eql(['a', 'b']);
            expect(_.find(presence, { key: 'a' }).user.name).to.equal('a');
          });
      });

      it('updates an entry in place', function () {
        return join('a')
          .then(() => store.sync({ page: PAGE, docs: [PAGE], key: 'a', entry: _.assign(entry('a'), { state: 'idle' }), expires: now + 1000, cursor: 0 }))
          .then(({ presence }) => {
            expect(presence).to.have.length(1);
            expect(presence[0].state).to.equal('idle');
          });
      });

      it('drops each entry when it expires', function () {
        return join('a', now + 1000)
          .then(() => join('hidden', now + 5000))
          .then(() => { now += 1500; })
          .then(() => join('b'))
          .then(({ presence }) => expect(_.map(presence, 'key').sort()).to.eql(['b', 'hidden']));
      });

      it('keeps pages separate', function () {
        return join('a')
          .then(() => store.sync({ page: `${SITE}/_pages/p2`, docs: [], key: 'b', entry: entry('b'), expires: now + 1000, cursor: 0 }))
          .then(({ presence }) => expect(_.map(presence, 'key')).to.eql(['b']));
      });

      it('removes a session that left', function () {
        return join('a')
          .then(() => store.leave(PAGE, 'a'))
          .then(() => store.sync({ page: PAGE, docs: [PAGE], key: 'b', entry: null, cursor: 0 }))
          .then(({ presence }) => expect(presence).to.eql([]));
      });
    });
  });
}

STORES.forEach(contract);
