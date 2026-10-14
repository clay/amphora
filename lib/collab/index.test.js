'use strict';

const _ = require('lodash'),
  express = require('express'),
  request = require('supertest'),
  expect = require('chai').expect,
  lib = require('./index'),
  responses = require('../responses'),
  db = require('../services/db'),
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
 * routes standing in for amphora's API.
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

    saved[req.uri] = req.body;
    res.json(req.body);
  });
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
  let req = request(app).put(path).set('Host', HOST);

  _.forOwn(headers, (value, key) => { req = req.set(key, value); });

  return req.send(body);
}

describe('Collab', function () {
  let app, saved, originalGet;

  beforeEach(function () {
    lib.setLog(_.noop);
    lib.configure(true);
    ({ app, saved } = makeApp());
    originalGet = db.get;
    db.get = uri => saved[uri] ? Promise.resolve(saved[uri]) : Promise.reject(new Error('not found'));
  });

  afterEach(function () {
    db.get = originalGet;
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
    it('parses non-negative integers', function () {
      expect(lib.parseRev('0')).to.equal(0);
      expect(lib.parseRev('12')).to.equal(12);
    });

    it('treats anything else as unconditional', function () {
      expect(lib.parseRev(undefined)).to.equal(null);
      expect(lib.parseRev('')).to.equal(null);
      expect(lib.parseRev('-1')).to.equal(null);
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
          expect(res.body.rev).to.equal(1);
          expect(res.body.uri).to.equal(CMPT);
          expect(saved[CMPT]).to.eql({ text: 'one' }); // not overwritten
        });
    });

    it('gives the revision back when the write fails', function () {
      return put(app, '/_components/text/instances/broken', {}, { 'x-clay-rev': '0' })
        .expect(500)
        .then(() => lib.getStore().revisions([`${HOST}/_components/text/instances/broken`]))
        .then(revs => expect(revs[`${HOST}/_components/text/instances/broken`]).to.equal(0));
    });

    it('lets saves through when the store fails', function () {
      lib.getStore().reserve = () => Promise.reject(new Error('down'));

      return put(app, '/_components/text/instances/a', { text: 'one' }, { 'x-clay-rev': '5' })
        .expect(200)
        .then(res => expect(res.headers['x-clay-rev']).to.equal(undefined));
    });

    it('stops asking a store that just failed, so saves stay fast', function () {
      let calls = 0;

      lib.getStore().reserve = () => {
        calls++;
        return Promise.reject(new Error('down'));
      };

      return put(app, '/_components/text/instances/a', { text: 'one' }).expect(200)
        .then(() => put(app, '/_components/text/instances/a', { text: 'two' }).expect(200))
        .then(() => request(app).get('/some/article.html?edit=true').set('Host', HOST))
        .then((res) => {
          expect(calls).to.equal(1);
          expect(res.body).to.equal(null);
        });
    });

    it('lets saves through when the store is slow', function () {
      lib.configure({ timeout: 20 });
      lib.getStore().reserve = () => new Promise(_.noop);

      return put(app, '/_components/text/instances/a', { text: 'one' }, { 'x-clay-rev': '5' }).expect(200);
    });

    it('ignores other sites\' uris', function () {
      return request(app).put('/_components/text/instances/a').set('Host', 'other.com').send({}).expect(200)
        .then(res => expect(res.headers['x-clay-rev']).to.equal(undefined));
    });

    it('sends the revision with collaborating reads', function () {
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
        .then(() => sync(app, { page: PAGE, session: 'sessionBBB1', cursor: 0 }, 'bob'))
        .then((res) => {
          expect(res.status).to.equal(200);
          expect(res.body.cursor).to.equal(1);
          expect(res.body.events).to.have.length(1);
          expect(res.body.events[0]).to.include({ id: 1, type: 'save', uri: CMPT, rev: 1 });
          expect(res.body.events[0].by.session).to.equal('sessionAAA1');
          expect(res.body.events[0].by.user).to.include({ name: 'Alice' });
          expect(res.body.events[0].by.user).not.to.have.property('username');
        });
    });

    it('records page saves and publishes in the page\'s own feed', function () {
      return put(app, '/_pages/p1', { layout: LAYOUT, main: [] })
        .then(() => request(app).put('/_pages/p1@published').set('Host', HOST).send({}))
        .then(() => sync(app, { page: PAGE, session: 'sessionBBB1', cursor: 0 }))
        .then(res => expect(_.map(res.body.events, 'type')).to.eql(['save', 'publish']));
    });

    it('records layout changes for anyone following the layout', function () {
      return put(app, '/_components/text/instances/a', { text: 'x' }, { 'x-clay-collab-doc': LAYOUT })
        .then(() => sync(app, { page: `${HOST}/_pages/other`, docs: [LAYOUT], session: 'sessionBBB1', cursor: 0 }))
        .then(res => expect(res.body.events).to.have.length(1));
    });

    it('records unpublishing and (un)scheduling on the page kiln names', function () {
      const doc = { 'x-clay-collab-doc': PAGE, 'x-clay-collab-session': 'sessionAAA1' };

      return request(app).delete('/_uris/abc').set('Host', HOST).set(doc).expect(204)
        .then(() => request(app).post('/_schedule').set('Host', HOST).set(doc).send({ at: 1, publish: 'x' }).expect(201))
        .then(() => request(app).delete('/_schedule/abc').set('Host', HOST).set(doc).expect(204))
        .then(() => request(app).delete('/_uris/def').set('Host', HOST).expect(204)) // no page named: not recorded
        .then(() => sync(app, { page: PAGE, session: 'sessionBBB1', cursor: 0 }, 'bob'))
        .then((res) => {
          expect(_.map(res.body.events, 'type')).to.eql(['unpublish', 'schedule', 'unschedule']);
          expect(_.uniq(_.map(res.body.events, 'uri'))).to.eql([PAGE]);
        });
    });

    it('does not record writes it cannot place', function () {
      return put(app, '/_components/text/instances/a', { text: 'x' })
        .then(() => sync(app, { page: PAGE, session: 'sessionBBB1', cursor: 0 }))
        .then(res => expect(res.body.events).to.eql([]));
    });

    it('ignores documents from another site', function () {
      return put(app, '/_components/text/instances/a', { text: 'x' }, { 'x-clay-collab-doc': 'other.com/_pages/p1' })
        .then(() => sync(app, { page: PAGE, session: 'sessionBBB1', cursor: 0 }))
        .then(res => expect(res.body.events).to.eql([]));
    });

    it('only returns events after the cursor', function () {
      const doc = { 'x-clay-collab-doc': PAGE };

      return put(app, '/_components/text/instances/a', { text: '1' }, doc)
        .then(() => put(app, '/_components/text/instances/a', { text: '2' }, doc))
        .then(() => sync(app, { page: PAGE, session: 'sessionBBB1', cursor: 1 }))
        .then(res => expect(_.map(res.body.events, 'id')).to.eql([2]));
    });

    it('starts at the latest event when joining without a cursor', function () {
      return put(app, '/_components/text/instances/a', { text: '1' }, { 'x-clay-collab-doc': PAGE })
        .then(() => sync(app, { page: PAGE, session: 'sessionBBB1' }))
        .then((res) => {
          expect(res.body.events).to.eql([]);
          expect(res.body.cursor).to.equal(1);
        });
    });
  });

  describe('presence', function () {
    it('shows everyone on the page, without private details', function () {
      return sync(app, { page: PAGE, session: 'sessionAAA1', focus: { uri: CMPT, path: 'text', label: 'Paragraph' } })
        .then(() => sync(app, { page: PAGE, session: 'sessionBBB1', state: 'idle' }, 'bob'))
        .then((res) => {
          const alice = _.find(res.body.presence, { session: 'sessionAAA1' }),
            bob = _.find(res.body.presence, { session: 'sessionBBB1' });

          expect(res.body.presence).to.have.length(2);
          expect(alice.user).to.have.keys(['id', 'name', 'imageUrl', 'color']);
          expect(alice.focus).to.eql({ uri: CMPT, path: 'text', label: 'Paragraph', typing: false });
          expect(bob.state).to.equal('idle');
        });
    });

    it('drops people who stop syncing', function () {
      let now = 1000;
      const store = new MemoryStore(_.assign({}, lib.DEFAULTS, { now: () => now }));

      lib.configure({ store, presenceTtl: 100 });

      return sync(app, { page: PAGE, session: 'sessionAAA1' })
        .then(() => { now = 1200; })
        .then(() => sync(app, { page: PAGE, session: 'sessionBBB1' }, 'bob'))
        .then(res => expect(_.map(res.body.presence, 'session')).to.eql(['sessionBBB1']));
    });

    it('removes a tab that left', function () {
      return sync(app, { page: PAGE, session: 'sessionAAA1' })
        .then(() => request(app).post('/_collab/leave').set('Host', HOST).set('Content-Type', 'text/plain').send(JSON.stringify({ page: PAGE, session: 'sessionAAA1' })).expect(204))
        .then(() => sync(app, { page: PAGE, session: 'sessionBBB1' }, 'bob'))
        .then(res => expect(_.map(res.body.presence, 'session')).to.eql(['sessionBBB1']));
    });

    it('cannot remove someone else\'s tab', function () {
      return sync(app, { page: PAGE, session: 'sessionAAA1' })
        .then(() => request(app).post('/_collab/leave').set('Host', HOST).set('x-test-user', 'bob').send({ page: PAGE, session: 'sessionAAA1' }))
        .then(() => sync(app, { page: PAGE, session: 'sessionBBB1' }, 'bob'))
        .then(res => expect(res.body.presence).to.have.length(2));
    });

    it('drops a focus on another site', function () {
      return sync(app, { page: PAGE, session: 'sessionAAA1', focus: { uri: 'other.com/_components/a/instances/b' } })
        .then(res => expect(res.body.presence[0].focus).to.equal(null));
    });

    it('returns revisions when asked (first sync)', function () {
      return put(app, '/_components/text/instances/a', { text: '1' })
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
        .then(() => request(app).get('/some/article.html?edit=true').set('Host', HOST))
        .then(res => expect(res.body).to.include({ enabled: true, path: '/_collab', cursor: 1 }));
    });

    it('stays out of view mode and api requests', function () {
      return Promise.all([
        request(app).get('/some/article.html').set('Host', HOST).then(res => expect(res.body).to.equal(null)),
        request(app).get('/_components/text/instances/a.html?edit=true').set('Host', HOST).then(res => expect(res.body).to.equal(null))
      ]);
    });

    it('renders without collaboration when the store fails', function () {
      lib.getStore().cursor = () => Promise.reject(new Error('down'));

      return request(app).get('/some/article.html?edit=true').set('Host', HOST).then(res => expect(res.body).to.equal(null));
    });
  });
});
