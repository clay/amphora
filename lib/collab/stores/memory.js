'use strict';

const crypto = require('crypto'),
  SWEEP_EVERY = 60000;

/**
 * In-process collaboration store.
 *
 * Holds revisions, per-document event feeds and presence in memory, so it only
 * works when every editor talks to the same Node process (local development,
 * tests, single-instance installs). Multi-instance deployments need the Redis
 * store, which implements the same interface.
 *
 * Every method returns a Promise so the two stores are interchangeable.
 */
class MemoryStore {
  /**
   * @param {object} options
   * @param {number} options.feedSize events kept per document
   * @param {number} options.feedTtl seconds an idle feed is kept
   * @param {number} options.revisionTtl seconds an untouched revision is kept
   * @param {number} options.lockTtl ms a write may hold a uri
   * @param {function} [options.now] clock, for tests
   */
  constructor({ feedSize, feedTtl, revisionTtl, lockTtl, now = Date.now }) {
    this.feedSize = feedSize;
    this.feedTtl = feedTtl * 1000;
    this.revisionTtl = revisionTtl * 1000;
    this.lockTtl = lockTtl;
    this.now = now;
    this.epochId = crypto.randomBytes(8).toString('hex');
    this.secret = crypto.randomBytes(32).toString('hex');
    this.revs = new Map(); // uri -> { rev, expires } (committed revisions)
    this.locks = new Map(); // uri -> { token, rev, prev, expires } (writes in flight)
    this.seqs = new Map(); // site prefix -> last event id
    this.feeds = new Map(); // doc uri -> { events: [newest first], start, expires }
    this.presence = new Map(); // page uri -> Map(key -> { entry, expires })
    this.lastSweep = this.now();
  }

  /**
   * Drop expired entries now and then, so a long-running process doesn't grow.
   */
  sweep() {
    const now = this.now();

    if (now - this.lastSweep < SWEEP_EVERY) {
      return;
    }

    this.lastSweep = now;
    this.revs.forEach((item, uri) => item.expires < now && this.revs.delete(uri));
    this.locks.forEach((item, uri) => item.expires < now && this.locks.delete(uri));
    this.feeds.forEach((feed, doc) => feed.expires < now && this.feeds.delete(doc));
    this.presence.forEach((sessions, page) => {
      sessions.forEach((item, key) => item.expires < now && sessions.delete(key));
      if (!sessions.size) {
        this.presence.delete(page);
      }
    });
  }

  /**
   * Committed revision of a uri (0 when it was never saved or has expired).
   * @param {string} uri
   * @returns {number}
   */
  currentRev(uri) {
    const item = this.revs.get(uri);

    if (!item || item.expires < this.now()) {
      this.revs.delete(uri);
      return 0;
    }

    return item.rev;
  }

  /**
   * @param {string} uri
   * @returns {object|null} the write in flight for a uri
   */
  currentLock(uri) {
    const lock = this.locks.get(uri);

    if (lock && lock.expires < this.now()) {
      this.locks.delete(uri);
      return null;
    }

    return lock || null;
  }

  /**
   * Start a write: check `expected` against the committed revision and, when
   * it matches (or no expectation is given), hold the uri until commit/release.
   * The new revision only becomes visible on commit, after the data is written.
   * @param {string} uri
   * @param {number|null} expected base revision, null = unconditional, -1 = always conflict
   * @param {string} token identifies this write
   * @returns {Promise<{ok: boolean, busy: boolean, rev: number, prev: number}>}
   */
  reserve(uri, expected, token) {
    const current = this.currentRev(uri);

    this.sweep();

    if (this.currentLock(uri)) {
      return Promise.resolve({ ok: false, busy: true, rev: current, prev: current });
    }

    if (expected !== null && expected !== current) {
      return Promise.resolve({ ok: false, busy: false, rev: current, prev: current });
    }

    this.locks.set(uri, { token, rev: current + 1, prev: current, expires: this.now() + this.lockTtl });

    return Promise.resolve({ ok: true, busy: false, rev: current + 1, prev: current });
  }

  /**
   * The write succeeded: publish its revision and let the next one in.
   * @param {string} uri
   * @param {string} token
   * @param {number} rev
   * @returns {Promise}
   */
  commit(uri, token, rev) {
    const lock = this.currentLock(uri);

    if (lock && lock.token === token) {
      this.locks.delete(uri);
    }

    if (this.currentRev(uri) < rev) {
      this.revs.set(uri, { rev, expires: this.now() + this.revisionTtl });
    }

    return Promise.resolve();
  }

  /**
   * The write failed: let the next one in, revision unchanged.
   * @param {string} uri
   * @param {string} token
   * @returns {Promise}
   */
  release(uri, token) {
    const lock = this.currentLock(uri);

    if (lock && lock.token === token) {
      this.locks.delete(uri);
    }

    return Promise.resolve();
  }

  /**
   * Move a revision forward without a check (writes made while the store was
   * unreachable, so open editors can't overwrite them later).
   * @param {string} uri
   * @returns {Promise<number>} the new revision
   */
  bump(uri) {
    const rev = this.currentRev(uri) + 1;

    this.revs.set(uri, { rev, expires: this.now() + this.revisionTtl });

    return Promise.resolve(rev);
  }

  /**
   * @param {string[]} uris
   * @returns {Promise<object>} uri -> committed revision
   */
  revisions(uris) {
    const result = {};

    uris.forEach((uri) => { result[uri] = this.currentRev(uri); });

    return Promise.resolve(result);
  }

  /**
   * Identifies this store's data: changes when the data is lost (restart of
   * an in-memory store), so clients know their cursors and revisions are stale.
   * @returns {Promise<string>}
   */
  epoch() {
    return Promise.resolve(this.epochId);
  }

  /**
   * A secret shared by every instance using this store (for opaque user ids).
   * @returns {Promise<string>}
   */
  salt() {
    return Promise.resolve(this.secret);
  }

  /**
   * Id of the latest event on a site; clients start reading after it.
   * @param {string} site site prefix
   * @returns {Promise<number>}
   */
  cursor(site) {
    return Promise.resolve(this.seqs.get(site) || 0);
  }

  /**
   * Add an event to a document's feed. Ids increase per site, so one cursor
   * covers every document a client follows.
   * @param {string} site site prefix
   * @param {string} doc page or layout uri
   * @param {object} event
   * @returns {Promise<number>} the event id
   */
  append(site, doc, event) {
    const id = (this.seqs.get(site) || 0) + 1,
      existing = this.feeds.get(doc),
      feed = existing && existing.expires >= this.now() ? existing : { events: [], start: 0 };

    this.seqs.set(site, id);
    feed.events.unshift(Object.assign({ id }, event));
    if (feed.events.length > this.feedSize) {
      // older events are gone: clients behind this point have to resync
      feed.events.length = this.feedSize;
      feed.start = feed.events[feed.events.length - 1].id;
    }
    feed.expires = this.now() + this.feedTtl;
    this.feeds.set(doc, feed);

    return Promise.resolve(id);
  }

  /**
   * Record a heartbeat and read everything a client needs in one go.
   * @param {object} options
   * @param {string} options.page page uri (presence is per page)
   * @param {string[]} options.docs documents to read events from
   * @param {string} options.key presence key of the client's tab
   * @param {object|null} options.entry presence entry, or null to only read
   * @param {number} options.expires when the entry should disappear (ms)
   * @param {number} options.cursor last event id the client has seen
   * @returns {Promise<{presence: object[], events: object[], start: number}>} start: for feeds that dropped old events, the oldest id kept (0 = nothing dropped)
   */
  sync({ page, docs, key, entry, expires, cursor }) {
    const now = this.now(),
      sessions = this.presence.get(page) || new Map(),
      presence = [];
    let events = [],
      start = 0;

    if (entry) {
      sessions.set(key, { entry, expires });
      this.presence.set(page, sessions);
    }

    sessions.forEach((item, sessionKey) => {
      if (item.expires < now) {
        sessions.delete(sessionKey);
      } else {
        presence.push(Object.assign({}, item.entry, { key: sessionKey }));
      }
    });

    if (!sessions.size) {
      this.presence.delete(page);
    }

    docs.forEach((doc) => {
      const feed = this.feeds.get(doc);

      if (feed && feed.expires >= now) {
        events = events.concat(feed.events.filter(event => event.id > cursor));
        start = Math.max(start, feed.start);
      }
    });

    return Promise.resolve({ presence, events, start });
  }

  /**
   * Drop a session's presence right away (tab closed, editor left).
   * @param {string} page
   * @param {string} key
   * @returns {Promise}
   */
  leave(page, key) {
    const sessions = this.presence.get(page);

    if (sessions) {
      sessions.delete(key);
      if (!sessions.size) {
        this.presence.delete(page);
      }
    }

    return Promise.resolve();
  }

  /**
   * @returns {Promise}
   */
  close() {
    return Promise.resolve();
  }
}

module.exports = MemoryStore;
