'use strict';

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
   * @param {function} [options.now] clock, for tests
   */
  constructor({ feedSize, feedTtl, revisionTtl, now = Date.now }) {
    this.feedSize = feedSize;
    this.feedTtl = feedTtl * 1000;
    this.revisionTtl = revisionTtl * 1000;
    this.now = now;
    this.revs = new Map(); // uri -> { rev, expires }
    this.seqs = new Map(); // site prefix -> last event id
    this.feeds = new Map(); // doc uri -> { events: [newest first], expires }
    this.presence = new Map(); // page uri -> Map(session -> { entry, ts })
  }

  /**
   * Current revision of a uri (0 when it was never saved or has expired).
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
   * Atomically check `expected` against the current revision and, when it
   * matches (or no expectation is given), reserve the next revision.
   * @param {string} uri
   * @param {number|null} expected base revision the client edited, or null
   * @returns {Promise<{ok: boolean, rev: number, prev: number}>}
   */
  reserve(uri, expected) {
    const current = this.currentRev(uri);

    if (expected !== null && expected !== current) {
      return Promise.resolve({ ok: false, rev: current, prev: current });
    }

    this.revs.set(uri, { rev: current + 1, expires: this.now() + this.revisionTtl });

    return Promise.resolve({ ok: true, rev: current + 1, prev: current });
  }

  /**
   * Undo a reservation after the write it guarded failed, unless someone else
   * has written since.
   * @param {string} uri
   * @param {number} reserved
   * @param {number} prev
   * @returns {Promise}
   */
  release(uri, reserved, prev) {
    if (this.currentRev(uri) === reserved) {
      if (prev) {
        this.revs.set(uri, { rev: prev, expires: this.now() + this.revisionTtl });
      } else {
        this.revs.delete(uri);
      }
    }

    return Promise.resolve();
  }

  /**
   * @param {string[]} uris
   * @returns {Promise<object>} uri -> revision
   */
  revisions(uris) {
    const result = {};

    uris.forEach(uri => { result[uri] = this.currentRev(uri); });

    return Promise.resolve(result);
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
      feed = this.feeds.get(doc) || { events: [] };

    this.seqs.set(site, id);
    feed.events.unshift(Object.assign({ id }, event));
    feed.events.length = Math.min(feed.events.length, this.feedSize);
    feed.expires = this.now() + this.feedTtl;
    this.feeds.set(doc, feed);

    return Promise.resolve(id);
  }

  /**
   * Record a heartbeat and read everything a client needs in one go.
   * @param {object} options
   * @param {string} options.page page uri (presence is per page)
   * @param {string[]} options.docs documents to read events from
   * @param {string} options.session client session id
   * @param {object|null} options.entry presence entry, or null to only read
   * @param {number} options.cursor last event id the client has seen
   * @param {number} options.presenceTtl ms before a silent session is dropped
   * @returns {Promise<{presence: object[], events: object[]}>}
   */
  sync({ page, docs, session, entry, cursor, presenceTtl }) {
    const now = this.now(),
      sessions = this.presence.get(page) || new Map(),
      presence = [];
    let events = [];

    if (entry) {
      sessions.set(session, { entry, ts: now });
      this.presence.set(page, sessions);
    }

    sessions.forEach((item, key) => {
      if (item.ts < now - presenceTtl) {
        sessions.delete(key);
      } else {
        presence.push(Object.assign({}, item.entry, { lastSeen: item.ts }));
      }
    });

    if (!sessions.size) {
      this.presence.delete(page);
    }

    docs.forEach(doc => {
      const feed = this.feeds.get(doc);

      if (feed && feed.expires < now) {
        this.feeds.delete(doc);
      } else if (feed) {
        events = events.concat(feed.events.filter(event => event.id > cursor));
      }
    });

    return Promise.resolve({ presence, events });
  }

  /**
   * Drop a session's presence right away (tab closed, editor left).
   * @param {string} page
   * @param {string} session
   * @returns {Promise}
   */
  leave(page, session) {
    const sessions = this.presence.get(page);

    if (sessions) {
      sessions.delete(session);
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
