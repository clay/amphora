'use strict';

const _ = require('lodash'),
  express = require('express'),
  request = require('supertest'),
  expect = require('chai').expect,
  lib = require('./index'),
  responses = require('../responses'),
  db = require('../services/db'),
  components = require('../services/components'),
  MemoryStore = require('./stores/memory'),
  HOST = 'localhost.example.com',
  PAGE = `${HOST}/_pages/p1`,
  LAYOUT = `${HOST}/_layouts/l/instances/a`,
  CMPT = `${HOST}/_components/text/instances/a`,
  ALICE = { username: 'alice@example.com', provider: 'google', name: 'Alice', auth: 'admin' },
  BOB = { username: 'bob@example.com', provider: 'google', name: 'Bob', auth: 'admin' },
  site = { slug: 'example', prefix: HOST, path: '/' };

/**
 * A site router with collaboration attached, a fake auth layer and a few
 * routes standing in for amphora's API. `x-delay` makes a write slow.
 * @param {object} [options]
 * @returns {object}
 */
function makeApp(options = {}) {
  const app = express(),
    saved = {};

  app.use((req, res, next) => {
    if (!options.anonymous) {
      req.user = req.get('x-test-user') === 'bob' ? BOB : ALICE;
    }
    req.uri = responses.getUri(req);
    _.assign(res.locals, req.query, { site });
    next();
  });
  lib.attach(app, site);
  app.put('/_components/text/instances/:id', express.json(), (req, res) => {
    if (req.params.id === 'broken') {
      return res.status(500).json({ message: 'nope' });
    }

    setTimeout(() => {
      saved[req.uri] = req.body;
      res.json(req.body);
    }, Number(req.get('x-delay') || 0));
  });
  app.put('/_layouts/l/instances/:id', express.json(), (req, res) => res.json(req.body));
  app.put('/_pages/:id', express.json(), (req, res) => res.json(req.body));
  app.put('/_pages/:id@published', (req, res) => res.json({}));
  app.delete('/_uris/:id', (req, res) => res.status(204).end());
  app.post('/_schedule', (req, res) => res.status(201).json({}));
  app.delete('/_schedule/:id', (req, res) => res.status(204).end());
  app.get('/_components/text/instances/:id.html', (req, res) => res.json(res.locals.collaboration || null));
  app.get('/_components/text/instances/:id', (req, res) => res.json(saved[req.uri] || {}));
  app.get('/some/article.html', (req, res) => res.json(res.locals.collaboration || null));

  return { app, saved };
}

/**
 * @param {object} app
 * @param {object} body
 * @param {string} [user]
 * @returns {Promise}
 */
function sync(app, body, user = 'alice') {
  return request(app).post('/_collab/sync').set('Host', HOST).set('x-test-user', user).send(body);
}

/**
 * @param {object} app
 * @param {string} path
 * @param {object} body
 * @param {object} [headers]
 * @returns {Promise}
 */
function put(app, path, body, headers = {}) {
  return request(app).put(path).set('Host', HOST).set(headers).send(body);
}

/**
 * @param {number} ms
 * @returns {Promise}
 */
function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

describe('Collab', function () {
  let app, saved, originalGet, originalComponentsGet;

  beforeEach(function () {
    lib.setLog(_.noop);
    lib.configure(true);
    ({ app, saved } = makeApp());
    originalGet = db.get;
    originalComponentsGet = components.get;
    db.get = uri => saved[uri] ? Promise.resolve(saved[uri]) : Promise.reject(Object.assign(new Error(`Key not found in database: ${uri}`), { name: 'NotFoundError' }));
    components.get = uri => db.get(uri);
  });

  afterEach(function () {
    db.get = originalGet;
    components.get = originalComponentsGet;
    lib.configure(false);
  });

  describe('configure', function () {
    it('is off unless enabled', function () {
      expect(lib.configure(undefined)).to.equal(null);
      expect(lib.isEnabled()).to.equal(false);
      expect(lib.configure({ enabled: false })).to.equal(null);
      expect(lib.isEnabled()).to.equal(false);
    });

    it('uses defaults for `true`', function () {
      const config = lib.configure(true);

      expect(lib.isEnabled()).to.equal(true);
      expect(config.pollInterval).to.equal(lib.DEFAULTS.pollInterval);
      expect(lib.getStore()).to.be.an.instanceof(MemoryStore);
    });

    it('accepts a custom store and overrides', function () {
      const store = { close: () => Promise.resolve() },
        config = lib.configure({ store, pollInterval: 1234 });

      expect(lib.getStore()).to.equal(store);
      expect(config.pollInterval).to.equal(1234);
    });
  });

  describe('classifyWrite', function () {
    const fn = lib.classifyWrite;

    it('ignores reads and creates', function () {
      expect(fn('GET', CMPT)).to.equal(null);
      expect(fn('POST', `${HOST}/_components/text/instances`)).to.equal(null);
    });

    it('guards saves of the latest version', function () {
      expect(fn('PUT', CMPT)).to.eql({ type: 'save', uri: CMPT, revision: true });
      expect(fn('DELETE', CMPT)).to.eql({ type: 'delete', uri: CMPT, revision: true });
      expect(fn('PUT', PAGE)).to.eql({ type: 'save', uri: PAGE, revision: true });
    });

    it('records publishing and scheduling without revisions', function () {
      expect(fn('PUT', `${PAGE}@published`)).to.eql({ type: 'publish', uri: PAGE, revision: false });
      expect(fn('DELETE', `${PAGE}@published`)).to.eql({ type: 'unpublish', uri: PAGE, revision: false });
      expect(fn('PUT', `${PAGE}@scheduled`)).to.eql({ type: 'schedule', uri: PAGE, revision: false });
      expect(fn('DELETE', `${PAGE}@scheduled`)).to.eql({ type: 'unschedule', uri: PAGE, revision: false });
      expect(fn('PATCH', `${PAGE}/meta`)).to.eql({ type: 'meta', uri: PAGE, revision: false });
    });

    it('ignores other versions', function () {
      expect(fn('PUT', `${CMPT}@abc`)).to.equal(null);
    });
  });

  describe('parseRev', function () {
    it('parses revisions, and -1 for "unknown"', function () {
      expect(lib.parseRev('0')).to.equal(0);
      expect(lib.parseRev('12')).to.equal(12);
      expect(lib.parseRev('-1')).to.equal(-1);
    });

    it('treats anything else as unconditional', function () {
      expect(lib.parseRev(undefined)).to.equal(null);
      expect(lib.parseRev('')).to.equal(null);
      expect(lib.parseRev('-2')).to.equal(null);
      expect(lib.parseRev('1.5')).to.equal(null);
      expect(lib.parseRev('abc')).to.equal(null);
    });
  });

  describe('revision guard', function () {
    it('assigns revisions to saves', function () {
      return put(app, '/_components/text/instances/a', { text: 'one' })
        .expect(200)
        .expect('X-Clay-Rev', '1')
        .then(() => put(app, '/_components/text/instances/a', { text: 'two' }).expect('X-Clay-Rev', '2'));
    });

    it('accepts a save based on the current revision', function () {
      return put(app, '/_components/text/instances/a', { text: 'one' }, { 'x-clay-rev': '0' })
        .expect(200)
        .expect('X-Clay-Rev', '1');
    });

    it('rejects a save based on an old revision with 412 and the current data', function () {
      return put(app, '/_components/text/instances/a', { text: 'one' }, { 'x-clay-rev': '0' })
        .then(() => put(app, '/_components/text/instances/a', { text: 'stale' }, { 'x-clay-rev': '0' }))
        .then((res) => {
          expect(res.status).to.equal(412);
          expect(res.headers['x-clay-rev']).to.equal('1');
          expect(res.body).to.include({ rev: 1, uri: CMPT, missing: false });
          expect(res.body.data).to.eql({ text: 'one' });
          expect(saved[CMPT]).to.eql({ text: 'one' }); // not overwritten
        });
    });

    it('answers an unknown base revision (-1) with the current data to merge', function () {
      return put(app, '/_components/text/instances/a', { text: 'one' })
        .then(() => put(app, '/_components/text/instances/a', { text: 'mine' }, { 'x-clay-rev': '-1' }))
        .then((res) => {
          expect(res.status).to.equal(412);
          expect(res.body).to.include({ rev: 1 });
          expect(res.body.data).to.eql({ text: 'one' });
        });
    });

    it('says when there is nothing saved to merge with', function () {
      return put(app, '/_components/text/instances/new', { text: 'mine' }, { 'x-clay-rev': '-1' })
        .then(res => expect(res.body).to.include({ missing: true, data: null }));
    });

    it('answers 503, not an empty 412, when the current data cannot be read', function () {
      db.get = () => Promise.reject(new Error('connection reset'));

      return put(app, '/_components/text/instances/a', { text: 'stale' }, { 'x-clay-rev': '5' }).expect(503);
    });

    it('never pairs a new revision with data that is not written yet', function () {
      // the race: Alice's save is slow; Bob saves on the same base meanwhile,
      // merges onto what he's told is current, and retries
      saved[CMPT] = { title: 'orig', body: 'orig' };

      // (supertest only sends a request once it's awaited)
      const alice = put(app, '/_components/text/instances/a', { title: 'A title', body: 'orig' }, { 'x-clay-rev': '0', 'x-delay': '150' }).then(res => res);

      return wait(30)
        .then(() => request(app).get('/_components/text/instances/a').set('Host', HOST).set('x-clay-collab-session', 'carolsession1'))
        .then((res) => {
          // a reader during Alice's write sees the committed revision with the committed data
          expect(res.headers['x-clay-rev']).to.equal('0');
          expect(res.body).to.eql({ title: 'orig', body: 'orig' });
        })
        .then(() => put(app, '/_components/text/instances/a', { title: 'orig', body: 'B body' }, { 'x-clay-rev': '0', 'x-test-user': 'bob' }))
        .then((res) => {
          // Bob waited for Alice's write, so his 412 carries her data
          expect(res.status).to.equal(412);
          expect(res.body.rev).to.equal(1);
          expect(res.body.data).to.eql({ title: 'A title', body: 'orig' });

          return put(app, '/_components/text/instances/a', _.assign({}, res.body.data, { body: 'B body' }), { 'x-clay-rev': String(res.body.rev), 'x-test-user': 'bob' });
        })
        .then(res => expect(res.status).to.equal(200))
        .then(() => alice)
        .then(() => expect(saved[CMPT]).to.eql({ title: 'A title', body: 'B body' }));
    });

    it('gives the revision back when the write fails', function () {
      return put(app, '/_components/text/instances/broken', {}, { 'x-clay-rev': '0' })
        .expect(500)
        .then(() => put(app, '/_components/text/instances/broken', {}, { 'x-clay-rev': '0' }))
        .then(res => expect(res.status).to.equal(500)) // not 412: still on revision 0
        .then(() => lib.getStore().revisions([`${HOST}/_components/text/instances/broken`]))
        .then(revs => expect(revs[`${HOST}/_components/text/instances/broken`]).to.equal(0));
    });

    it('lets saves through when the store fails, and catches up when it is back', function () {
      lib.configure({ retryAfter: 0 });

      const store = lib.getStore(),
        reserve = store.reserve;

      store.reserve = () => Promise.reject(new Error('down'));

      return put(app, '/_components/text/instances/a', { text: 'one' }, { 'x-clay-rev': '5', 'x-clay-collab-doc': PAGE })
        .expect(200)
        .then(res => expect(res.headers['x-clay-rev']).to.equal(undefined))
        .then(() => { store.reserve = reserve; })
        // the next successful store call catches up: the revision moves on, and others hear about it
        .then(() => sync(app, { page: PAGE, session: 'sessionBBB1', cursor: 0 }, 'bob'))
        .then(() => wait(10))
        .then(() => Promise.all([store.revisions([CMPT]), sync(app, { page: PAGE, session: 'sessionBBB1', cursor: 0 }, 'bob')]))
        .then(([revs, res]) => {
          expect(revs[CMPT]).to.equal(1);
          expect(_.map(res.body.events, 'uri')).to.eql([CMPT]);
        });
    });

    it('stops asking a store that just failed, so saves stay fast', function () {
      let calls = 0;

      lib.getStore().reserve = () => {
        calls++;
        return Promise.reject(new Error('down'));
      };

      return put(app, '/_components/text/instances/a', { text: 'one' }).expect(200)
        .then(() => put(app, '/_components/text/instances/a', { text: 'two' }).expect(200))
        .then(() => expect(calls).to.equal(1));
    });

    it('lets saves through when the store is slow', function () {
      lib.configure({ timeout: 20 });
      lib.getStore().reserve = () => new Promise(_.noop);

      return put(app, '/_components/text/instances/a', { text: 'one' }, { 'x-clay-rev': '5' }).expect(200);
    });

    it('goes ahead (unguarded) if another write holds the uri for too long', function () {
      lib.configure({ lockWait: 50 });

      return lib.getStore().reserve(CMPT, null, 'stuck')
        .then(() => put(app, '/_components/text/instances/a', { text: 'one' }, { 'x-clay-rev': '0' }))
        .then(res => expect(res.status).to.equal(200));
    });

    it('ignores other sites\' uris', function () {
      return request(app).put('/_components/text/instances/a').set('Host', 'other.com').send({}).expect(200)
        .then(res => expect(res.headers['x-clay-rev']).to.equal(undefined));
    });

    it('sends the committed revision with collaborating reads', function () {
      return put(app, '/_components/text/instances/a', { text: 'one' })
        .then(() => request(app).get('/_components/text/instances/a').set('Host', HOST).set('x-clay-collab-session', 'sessionAAA1'))
        .then(res => expect(res.headers['x-clay-rev']).to.equal('1'));
    });

    it('does not add revisions to other reads', function () {
      return request(app).get('/_components/text/instances/a').set('Host', HOST)
        .then(res => expect(res.headers['x-clay-rev']).to.equal(undefined));
    });
  });

  describe('change feed', function () {
    it('records saves in the document kiln names, with who made them', function () {
      return put(app, '/_components/text/instances/a', { text: 'one' }, { 'x-clay-collab-session': 'sessionAAA1', 'x-clay-collab-doc': PAGE })
        .then(() => wait(5))
        .then(() => sync(app, { page: PAGE, session: 'sessionBBB1', cursor: 0 }, 'bob'))
        .then((res) => {
          const event = res.body.events[0];

          expect(res.status).to.equal(200);
          expect(res.body.cursor).to.equal(1);
          expect(res.body.events).to.have.length(1);
          expect(event).to.include({ id: 1, type: 'save', uri: CMPT, rev: 1 });
          expect(event.by.own).to.equal(false);
          expect(event.by).not.to.have.property('session');
          expect(event.by.user).to.include({ name: 'Alice' });
          expect(event.by.user).not.to.have.property('username');
        });
    });

    it('tells a tab which events are its own', function () {
      return put(app, '/_components/text/instances/a', { text: 'one' }, { 'x-clay-collab-session': 'sessionAAA1', 'x-clay-collab-doc': PAGE })
        .then(() => wait(5))
        .then(() => sync(app, { page: PAGE, session: 'sessionAAA1', cursor: 0 }))
        .then(res => expect(res.body.events[0].by.own).to.equal(true));
    });

    it('records page saves and publishes in the page\'s own feed', function () {
      return put(app, '/_pages/p1', { layout: LAYOUT, main: [] })
        .then(() => request(app).put('/_pages/p1@published').set('Host', HOST).send({}))
        .then(() => wait(5))
        .then(() => sync(app, { page: PAGE, session: 'sessionBBB1', cursor: 0 }))
        .then(res => expect(_.map(res.body.events, 'type')).to.eql(['save', 'publish']));
    });

    it('records component changes for anyone following the layout', function () {
      return put(app, '/_components/text/instances/a', { text: 'x' }, { 'x-clay-collab-doc': LAYOUT })
        .then(() => wait(5))
        .then(() => sync(app, { page: `${HOST}/_pages/other`, docs: [LAYOUT], session: 'sessionBBB1', cursor: 0 }))
        .then(res => expect(res.body.events).to.have.length(1));
    });

    it('records layout saves on the layout, whatever page kiln names', function () {
      return put(app, '/_layouts/l/instances/a', { main: [] }, { 'x-clay-collab-doc': PAGE })
        .then(() => wait(5))
        .then(() => Promise.all([
          sync(app, { page: PAGE, session: 'sessionBBB1', cursor: 0 }),
          sync(app, { page: `${HOST}/_pages/other`, docs: [LAYOUT], session: 'sessionCCC1', cursor: 0 })
        ]))
        .then(([onPage, onLayout]) => {
          expect(onPage.body.events).to.have.length(0);
          expect(onLayout.body.events).to.have.length(1);
        });
    });

    it('records unpublishing and (un)scheduling on the page kiln names', function () {
      const doc = { 'x-clay-collab-doc': PAGE, 'x-clay-collab-session': 'sessionAAA1' };

      return request(app).delete('/_uris/abc').set('Host', HOST).set(doc).expect(204)
        .then(() => request(app).post('/_schedule').set('Host', HOST).set(doc).send({ at: 1, publish: 'x' }).expect(201))
        .then(() => request(app).delete('/_schedule/abc').set('Host', HOST).set(doc).expect(204))
        .then(() => request(app).delete('/_uris/def').set('Host', HOST).expect(204)) // no page named: not recorded
        .then(() => wait(5))
        .then(() => sync(app, { page: PAGE, session: 'sessionBBB1', cursor: 0 }, 'bob'))
        .then((res) => {
          expect(_.map(res.body.events, 'type')).to.eql(['unpublish', 'schedule', 'unschedule']);
          expect(_.uniq(_.map(res.body.events, 'uri'))).to.eql([PAGE]);
        });
    });

    it('does not record writes it cannot place', function () {
      return put(app, '/_components/text/instances/a', { text: 'x' })
        .then(() => wait(5))
        .then(() => sync(app, { page: PAGE, session: 'sessionBBB1', cursor: 0 }))
        .then(res => expect(res.body.events).to.eql([]));
    });

    it('ignores documents from another site', function () {
      return put(app, '/_components/text/instances/a', { text: 'x' }, { 'x-clay-collab-doc': 'other.com/_pages/p1' })
        .then(() => wait(5))
        .then(() => sync(app, { page: PAGE, session: 'sessionBBB1', cursor: 0 }))
        .then(res => expect(res.body.events).to.eql([]));
    });

    it('only returns events after the cursor', function () {
      const doc = { 'x-clay-collab-doc': PAGE };

      return put(app, '/_components/text/instances/a', { text: '1' }, doc)
        .then(() => put(app, '/_components/text/instances/a', { text: '2' }, doc))
        .then(() => wait(5))
        .then(() => sync(app, { page: PAGE, session: 'sessionBBB1', cursor: 1 }))
        .then(res => expect(_.map(res.body.events, 'id')).to.eql([2]));
    });

    it('starts at the latest event when joining without a cursor', function () {
      return put(app, '/_components/text/instances/a', { text: '1' }, { 'x-clay-collab-doc': PAGE })
        .then(() => wait(5))
        .then(() => sync(app, { page: PAGE, session: 'sessionBBB1' }))
        .then((res) => {
          expect(res.body.events).to.eql([]);
          expect(res.body.cursor).to.equal(1);
        });
    });
  });

  describe('resync', function () {
    it('asks a client to start over when the store lost its data (new epoch)', function () {
      return sync(app, { page: PAGE, session: 'sessionBBB1', cursor: 0, epoch: 'from-before-a-restart' })
        .then((res) => {
          expect(res.body.resync).to.equal(true);
          expect(res.body.epoch).to.be.a('string').and.not.equal('from-before-a-restart');
        });
    });

    it('asks a client to start over when its cursor is ahead of the feed', function () {
      return sync(app, { page: PAGE, session: 'sessionBBB1', cursor: 50 })
        .then((res) => {
          expect(res.body.resync).to.equal(true);
          expect(res.body.cursor).to.equal(0);
        });
    });

    it('asks a client to start over when events it missed were dropped', function () {
      lib.configure({ feedSize: 2 });

      return Promise.all(_.times(4, i => put(app, '/_components/text/instances/a', { text: String(i) }, { 'x-clay-collab-doc': PAGE })))
        .then(() => wait(10))
        .then(() => sync(app, { page: PAGE, session: 'sessionBBB1', cursor: 0 }))
        .then(res => expect(res.body.resync).to.equal(true));
    });

    it('carries on normally otherwise', function () {
      return sync(app, { page: PAGE, session: 'sessionBBB1', cursor: 0 })
        .then(first => sync(app, { page: PAGE, session: 'sessionBBB1', cursor: 0, epoch: first.body.epoch }))
        .then(res => expect(res.body.resync).to.equal(false));
    });
  });

  describe('presence', function () {
    it('shows everyone on the page, without private details', function () {
      return sync(app, { page: PAGE, session: 'sessionAAA1', focus: { uri: CMPT, path: 'text', label: 'Paragraph' } })
        .then(() => sync(app, { page: PAGE, session: 'sessionBBB1', state: 'idle' }, 'bob'))
        .then((res) => {
          const alice = _.find(res.body.presence, entry => entry.user.name === 'Alice'),
            bob = _.find(res.body.presence, entry => entry.user.name === 'Bob');

          expect(res.body.presence).to.have.length(2);
          expect(alice).to.have.keys(['tab', 'self', 'user', 'focus', 'state']);
          expect(alice.self).to.equal(false);
          expect(bob.self).to.equal(true);
          expect(alice.tab).to.match(/^[0-9a-f]{16}$/);
          expect(JSON.stringify(res.body)).not.to.include('sessionAAA1');
          expect(alice.user).to.have.keys(['id', 'name', 'imageUrl', 'color']);
          expect(alice.focus).to.eql({ uri: CMPT, path: 'text', label: 'Paragraph', typing: false });
          expect(bob.state).to.equal('idle');
        });
    });

    it('keeps background tabs around longer than active ones', function () {
      lib.configure({ presenceTtl: 50, hiddenPresenceTtl: 1000 });

      return sync(app, { page: PAGE, session: 'sessionAAA1' })
        .then(() => sync(app, { page: PAGE, session: 'sessionHHH1', state: 'hidden' }, 'bob'))
        .then(() => wait(100))
        .then(() => sync(app, { page: `${HOST}/_pages/p1`, session: 'sessionCCC1' }, 'bob'))
        .then(res => expect(_.map(res.body.presence, 'state').sort()).to.eql(['active', 'hidden']));
    });

    it('removes a tab that left', function () {
      return sync(app, { page: PAGE, session: 'sessionAAA1' })
        .then(() => request(app).post('/_collab/leave').set('Host', HOST).set('Content-Type', 'text/plain').send(JSON.stringify({ page: PAGE, session: 'sessionAAA1' })).expect(204))
        .then(() => sync(app, { page: PAGE, session: 'sessionBBB1' }, 'bob'))
        .then(res => expect(_.map(res.body.presence, 'user.name')).to.eql(['Bob']));
    });

    it('cannot remove someone else\'s tab', function () {
      return sync(app, { page: PAGE, session: 'sessionAAA1' })
        .then(() => request(app).post('/_collab/leave').set('Host', HOST).set('x-test-user', 'bob').send({ page: PAGE, session: 'sessionAAA1' }))
        .then(() => sync(app, { page: PAGE, session: 'sessionBBB1' }, 'bob'))
        .then(res => expect(res.body.presence).to.have.length(2));
    });

    it('drops a focus on another site, or one that could break a selector', function () {
      return sync(app, { page: PAGE, session: 'sessionAAA1', focus: { uri: 'other.com/_components/a/instances/b' } })
        .then(res => expect(res.body.presence[0].focus).to.equal(null))
        .then(() => sync(app, { page: PAGE, session: 'sessionAAA1', focus: { uri: `${HOST}/_components/a/instances/b"]`, path: 'text' } }))
        .then(res => expect(res.body.presence[0].focus).to.equal(null))
        .then(() => sync(app, { page: PAGE, session: 'sessionAAA1', focus: { uri: CMPT, path: 'te"xt' } }))
        .then(res => expect(res.body.presence[0].focus.path).to.equal(null));
    });

    it('returns committed revisions when asked (first sync)', function () {
      return put(app, '/_components/text/instances/a', { text: '1' })
        .then(() => wait(5))
        .then(() => sync(app, { page: PAGE, session: 'sessionAAA1', uris: [CMPT, `${CMPT}@published`, 'other.com/_components/x/instances/y'] }))
        .then(res => expect(res.body.revs).to.eql({ [CMPT]: 1 }));
    });
  });

  describe('sync requests', function () {
    it('rejects bad requests', function () {
      return Promise.all([
        sync(app, {}).expect(400),
        sync(app, { page: PAGE, session: 'short' }).expect(400),
        sync(app, { page: 'other.com/_pages/p1', session: 'sessionAAA1' }).expect(400),
        sync(app, { page: CMPT, session: 'sessionAAA1' }).expect(400)
      ]);
    });

    it('requires a user', function () {
      const anon = makeApp({ anonymous: true }).app;

      return request(anon).post('/_collab/sync').set('Host', HOST).send({ page: PAGE, session: 'sessionAAA1' }).expect(401);
    });

    it('refuses requests from other sites', function () {
      return request(app).post('/_collab/sync').set('Host', HOST).set('Origin', 'https://evil.example').send({ page: PAGE, session: 'sessionAAA1' }).expect(403);
    });

    it('accepts requests from its own pages', function () {
      return request(app).post('/_collab/sync').set('Host', HOST).set('Origin', `https://${HOST}`).send({ page: PAGE, session: 'sessionAAA1' }).expect(200);
    });

    it('only accepts JSON for sync (no cross-site form posts)', function () {
      return request(app).post('/_collab/sync').set('Host', HOST).set('Content-Type', 'text/plain').send(JSON.stringify({ page: PAGE, session: 'sessionAAA1' })).expect(400);
    });

    it('is not cached', function () {
      return sync(app, { page: PAGE, session: 'sessionAAA1' }).expect('Cache-Control', 'no-store');
    });

    it('returns 503 when the store fails', function () {
      lib.getStore().sync = () => Promise.reject(new Error('down'));

      return sync(app, { page: PAGE, session: 'sessionAAA1' }).expect(503);
    });
  });

  describe('edit-mode locals', function () {
    it('tells kiln about collaboration when a page is opened for editing', function () {
      return put(app, '/_components/text/instances/a', { text: '1' }, { 'x-clay-collab-doc': PAGE })
        .then(() => wait(5))
        .then(() => request(app).get('/some/article.html?edit=true').set('Host', HOST))
        .then(res => expect(res.body).to.include({ enabled: true, path: '/_collab', cursor: 1 }));
    });

    it('stays out of view mode and api requests', function () {
      return Promise.all([
        request(app).get('/some/article.html').set('Host', HOST).then(res => expect(res.body).to.equal(null)),
        request(app).get('/_components/text/instances/a.html?edit=true').set('Host', HOST).then(res => expect(res.body).to.equal(null))
      ]);
    });

    it('still turns kiln on, without a feed position, when the store fails', function () {
      lib.getStore().cursor = () => Promise.reject(new Error('down'));

      return request(app).get('/some/article.html?edit=true').set('Host', HOST)
        .then(res => expect(res.body).to.include({ enabled: true, cursor: null }));
    });
  });
});
