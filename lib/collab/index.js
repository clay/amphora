'use strict';

/**
 * Real-time collaboration for editors (opt-in).
 *
 * When enabled, amphora:
 * - keeps a revision number for every component, layout and page, and rejects
 *   a save based on an older revision with 412 (so one editor can no longer
 *   silently overwrite another's work) instead of last-write-wins
 * - records what each editor saved, published or changed in a short feed per
 *   page/layout
 * - tracks who is editing which page, and which component they're on
 * - serves all of that to clay-kiln through one small polling endpoint,
 *   POST /_collab/sync, so it works through any proxy or CDN (no WebSockets,
 *   no sticky sessions)
 *
 * Disabled (the default), none of this is mounted: no extra routes, middleware
 * or storage calls, and responses are unchanged.
 *
 * Everything here fails open: if the store is slow or down, saves go through
 * unguarded and pages render without collaboration, exactly as before. Once
 * the store is back, those writes' revisions move forward, and every client
 * is told to re-read what it has (a new "gap"), since writes may also have
 * gone around the store on an instance that stopped before it could say so.
 *
 * Revisions are two-phase: a write holds its uri (a short lock) while it runs,
 * and its new revision becomes visible only once it has succeeded, so nobody
 * can ever see a revision paired with data that isn't written yet. A second
 * write to the same uri waits for the first to finish.
 */

const crypto = require('crypto'),
  express = require('express'),
  bodyParser = require('body-parser'),
  { getPrefix, isComponent, isLayout, isPage, replaceVersion } = require('clayutils'),
  MemoryStore = require('./stores/memory'),
  RedisStore = require('./stores/redis'),
  { publicIdentity, userId, tabId } = require('./identity'),
  HEADERS = {
    session: 'x-clay-collab-session', // the editor tab making the request
    doc: 'x-clay-collab-doc', // page or layout the change belongs to
    rev: 'x-clay-rev', // request: revision the edit is based on (-1: unknown, always merge); response: revision after the write
    gap: 'x-clay-collab-gap' // the store's gap the client's revisions come from
  },
  DEFAULTS = {
    keyPrefix: 'clay:collab',
    pollInterval: 2000, // ms between syncs while others are on the page
    soloPollInterval: 4000, // ms between syncs while nobody else is
    hiddenPollInterval: 20000, // ms between syncs while the tab is in the background
    idlePollInterval: 30000, // ms between syncs after 5 minutes without input
    presenceTtl: 45000, // ms without a sync before an editor disappears (longer than the slowest poll)
    hiddenPresenceTtl: 150000, // same, for background tabs (browsers slow their timers to once a minute)
    feedSize: 200, // events kept per page/layout
    feedTtl: 3600, // seconds a quiet feed is kept
    revisionTtl: 7 * 24 * 3600, // seconds an untouched revision is kept
    lockTtl: 15000, // ms a write may hold its uri (if its instance dies mid-write)
    lockWait: 5000, // ms a write waits for another write to the same uri before going ahead unguarded
    timeout: 500, // ms to wait for the store before carrying on without it
    retryAfter: 10000 // ms to stop asking a store that just failed (saves stay fast while it's down)
  },
  SESSION_PATTERN = /^[A-Za-z0-9_-]{8,64}$/,
  // uris and paths from clients end up in other editors' CSS selectors
  SAFE_URI = /^[^\s"'`<>\\[\]{}]+$/,
  SAFE_PATH = /^[A-Za-z0-9_.-]{1,200}$/,
  STATES = ['active', 'idle', 'hidden'],
  NOT_WRITES = ['GET', 'HEAD', 'OPTIONS', 'POST'],
  // versions whose writes are events for editors: [on PUT, on DELETE]
  VERSION_EVENTS = { published: ['publish', 'unpublish'], scheduled: ['schedule', 'unschedule'] },
  NON_PAGE_ROUTES = /^\/_(components|layouts|lists|uris|users|auth|collab|schedule)(\/|$)/,
  MAX_UNGUARDED = 2000,
  MAX_REPORTED = 100,
  WAIT_STEP = 25;
let log = require('../services/logger').setup({ file: __filename }),
  config = null,
  store = null,
  unavailableUntil = 0,
  // writes that went through while the store was unreachable: once it's back,
  // their revisions move forward so open editors can't overwrite them
  unguarded = new Map(),
  // the store couldn't be reached (or wasn't there when this process
  // started): once it's back, start a new gap so every client re-reads
  gapPending = false;

/**
 * Reject if a store call takes too long, so collaboration can never hold up a
 * save or a page render.
 * @param {Promise} promise
 * @param {number} ms
 * @returns {Promise}
 */
function withTimeout(promise, ms) {
  let timer;

  return Promise.race([
    promise,
    new Promise((resolve, reject) => {
      timer = setTimeout(() => reject(new Error(`collaboration store timed out after ${ms}ms`)), ms);
    })
  ]).then((result) => {
    clearTimeout(timer);
    return result;
  }, (err) => {
    clearTimeout(timer);
    throw err;
  });
}

/**
 * Remember a write that went through without the store, to catch up on later.
 * @param {object} write { uri, site, doc, event }
 */
function keepUnguarded(write) {
  if (!unguarded.has(write.uri) && unguarded.size < MAX_UNGUARDED) {
    unguarded.set(write.uri, write);
  }
}

/**
 * The store answers again after it couldn't be reached. Move the revisions of
 * the writes made without it forward (so open editors can't overwrite them),
 * and start a new gap: clients that see it re-read everything they have,
 * because this process can't know about every write that went around the
 * store (another instance's, or one made by a process that stopped before
 * the store came back).
 */
function catchUp() {
  const pending = Array.from(unguarded.values()),
    gap = gapPending;

  unguarded.clear();
  gapPending = false;

  if (gap) {
    Promise.resolve().then(() => store.newGap()).then(() => log('info', 'collaboration store is back: editors will re-read their pages'), (err) => {
      gapPending = true;
      log('warn', `collaboration: could not start a new gap: ${err.message}`);
    });
  }

  pending.forEach((write) => {
    Promise.resolve().then(() => store.bump(write.uri)).then(
      rev => write.doc && store.append(write.site, write.doc, Object.assign({}, write.event, { rev }))
        .catch(err => log('warn', `collaboration: could not record the catch-up of ${write.uri}: ${err.message}`)),
      (err) => {
        log('warn', `collaboration: could not catch up on ${write.uri}: ${err.message}`);
        keepUnguarded(write); // next time
      }
    );
  });
}

/**
 * Call the store, but never wait on it for long, and after a failure leave it
 * alone for a while: if Redis is down, saves and page renders shouldn't each
 * pay the timeout.
 * @param {function} fn returns a promise from the store
 * @returns {Promise}
 */
function callStore(fn) {
  if (Date.now() < unavailableUntil) {
    return Promise.reject(new Error('collaboration store unavailable'));
  }

  return withTimeout(Promise.resolve().then(fn), config.timeout).then((result) => {
    if (gapPending || unguarded.size) {
      catchUp();
    }

    return result;
  }, (err) => {
    if (Date.now() >= unavailableUntil) {
      log('warn', `collaboration store failed, pausing collaboration for ${config.retryAfter}ms: ${err.message}`);
    }
    // writes go through unguarded until it's back
    gapPending = true;
    unavailableUntil = Date.now() + config.retryAfter;
    throw err;
  });
}

/**
 * @param {object} options
 * @returns {string} which kind of store is in use, for logs
 */
function storeName(options) {
  if (options.store) {
    return 'custom';
  }

  return options.redis ? 'redis' : 'memory';
}

/**
 * Create the store from the options.
 * @param {object} options
 * @returns {object}
 */
function createStore(options) {
  if (options.store) {
    return options.store;
  }

  if (options.redis) {
    let lastLogged = 0;

    return new RedisStore(Object.assign({}, options, {
      // ioredis keeps reconnecting (and erroring) while Redis is down: log that once a minute, not every attempt
      onError: (err) => {
        if (Date.now() - lastLogged > 60000) {
          lastLogged = Date.now();
          log('warn', `collaboration redis error (collaboration pauses until it's back): ${err.message}`);
        }
      }
    }));
  }

  if (process.env.NODE_ENV === 'production') {
    log('warn', 'Collaboration is using the in-memory store: editors on different instances will not see each other. Pass `collaboration.redis`.');
  }

  return new MemoryStore(options);
}

/**
 * Turn collaboration on or off. Called once at startup with amphora's
 * `collaboration` option.
 *
 * @param {boolean|object} [options] `true`, or:
 * @param {boolean} [options.enabled=true]
 * @param {string|object} [options.redis] Redis URL or ioredis client (required when running more than one instance)
 * @param {object} [options.store] custom store implementing the MemoryStore interface
 * @param {number} [options.pollInterval] ms between syncs while others are on the page
 * @param {number} [options.soloPollInterval] ms between syncs while nobody else is
 * @param {number} [options.hiddenPollInterval] ms between syncs from background tabs
 * @param {number} [options.idlePollInterval] ms between syncs from idle editors
 * @param {number} [options.presenceTtl] ms before a silent editor is dropped
 * @returns {object|null} the resolved config, or null when disabled
 */
function configure(options) {
  if (store) {
    store.close().catch(() => {});
  }

  config = null;
  store = null;
  unavailableUntil = 0;
  unguarded = new Map();
  gapPending = false;

  if (!options || options.enabled === false) {
    return null;
  }

  config = Object.assign({}, DEFAULTS, options === true ? {} : options);
  store = createStore(config);
  log('info', `Collaboration enabled (${storeName(config)} store)`);
  // if the store can't be reached as this process starts, the one before it
  // may have saved without it and lost track of those writes when it stopped:
  // a failure here starts a new gap once the store is back
  callStore(() => store.epoch()).catch(() => {});

  return config;
}

/**
 * @returns {boolean}
 */
function isEnabled() {
  return !!config;
}

/**
 * Parse a revision header.
 * @param {string} [value]
 * @returns {number|null} null when absent or invalid (write is unconditional); -1 means "unknown, send me the current data"
 */
function parseRev(value) {
  const rev = Number(value);

  return value !== undefined && value !== '' && Number.isInteger(rev) && rev >= -1 ? rev : null;
}

/**
 * What kind of write a request is, as far as collaboration cares.
 * @param {string} method
 * @param {string} uri request uri (amphora's req.uri)
 * @returns {{type: string, uri: string, revision: boolean}|null}
 */
function classifyWrite(method, uri) {
  const path = uri.replace(/\/meta$/, ''),
    base = replaceVersion(path),
    version = path.split('@')[1],
    events = VERSION_EVENTS[version];

  if (NOT_WRITES.indexOf(method) > -1) {
    return null; // POSTs create new things nobody else is editing yet
  }

  if (path !== uri) {
    return { type: 'meta', uri: base, revision: false };
  }

  if (events) {
    return { type: events[method === 'DELETE' ? 1 : 0], uri: base, revision: false };
  }

  if (version || /\/instances$/.test(base)) {
    return null; // other tagged versions aren't what editors work on
  }

  return { type: method === 'DELETE' ? 'delete' : 'save', uri: base, revision: true };
}

/**
 * Writes outside components, layouts and pages that editors still care about:
 * unpublishing removes the page's url (DELETE /_uris/...), scheduling goes
 * through /_schedule. They're recorded on the page kiln names.
 * @param {string} method
 * @param {string} uri
 * @returns {{type: string, revision: boolean}|null}
 */
function classifyPageAction(method, uri) {
  if (/\/_uris\/[^/]+$/.test(uri) && method === 'DELETE') {
    return { type: 'unpublish', revision: false };
  }

  if (/\/_schedule(\/[^/]+)?$/.test(uri) && (method === 'POST' || method === 'DELETE')) {
    return { type: method === 'POST' ? 'schedule' : 'unschedule', revision: false };
  }

  return null;
}

/**
 * True for uris of this site's components, layouts and pages.
 * @param {string} uri
 * @param {object} site
 * @returns {boolean}
 */
function isSiteContent(uri, site) {
  return typeof uri === 'string' && (isComponent(uri) || isLayout(uri) || isPage(uri)) && getPrefix(uri) === site.prefix;
}

/**
 * True for a layout instance (not a component inside one).
 * @param {string} uri
 * @returns {boolean}
 */
function isLayoutInstance(uri) {
  return !isComponent(uri) && /\/_layouts\/[^/]+\/instances\/[^/@]+$/.test(uri);
}

/**
 * True for page and layout instance uris of this site (the "documents" whose
 * feeds editors follow).
 * @param {string} uri
 * @param {object} site
 * @returns {boolean}
 */
function isDocument(uri, site) {
  return isSiteContent(uri, site) && !isComponent(uri) && (isPage(uri) || isLayoutInstance(uri));
}

/**
 * Which document feed a write goes to. Pages and layouts are their own
 * document (whatever header comes along); components belong to the page or
 * layout kiln names. Writes from other clients (scripts, importers) have no
 * document: they still get revisions, so kiln can't overwrite them, they just
 * don't show up live.
 * @param {object} req
 * @param {string} uri
 * @param {object} site
 * @returns {string|null}
 */
function documentFor(req, uri, site) {
  const doc = req.get(HEADERS.doc);

  if (isDocument(uri, site)) {
    return uri;
  }

  return doc && isDocument(doc, site) ? doc : null;
}

/**
 * Run `fn` once the response is done: finished, or the connection closed.
 * @param {object} res
 * @param {function} fn called with `true` when the response was sent completely
 */
function afterResponse(res, fn) {
  let done = false;

  const once = (finished) => {
    if (!done) {
      done = true;
      fn(finished);
    }
  };

  res.once('finish', () => once(true));
  res.once('close', () => once(res.writableFinished));
}

/**
 * The event recorded for a write. The session stays on the server (it's how
 * a tab recognizes its own changes); other editors only get `own: false`.
 * @param {object} req
 * @param {object} target
 * @param {string} secret
 * @returns {object}
 */
function eventFor(req, target, secret) {
  const session = req.get(HEADERS.session);

  return {
    type: target.type,
    uri: target.uri,
    by: {
      session: SESSION_PATTERN.test(session || '') ? session : null,
      user: req.user ? publicIdentity(req.user, secret) : null
    },
    at: Date.now()
  };
}

/**
 * Record a successful write in its document's feed.
 * @param {object} req
 * @param {object} site
 * @param {object} target from classifyWrite
 * @param {number} [rev]
 * @returns {Promise}
 */
function recordEvent(req, site, target, rev) {
  const doc = documentFor(req, target.uri, site);

  if (!doc) {
    return Promise.resolve();
  }

  return callStore(() => store.salt())
    .then(secret => callStore(() => store.append(site.prefix, doc, Object.assign(eventFor(req, target, secret), rev ? { rev } : {}))))
    .catch(err => log('warn', `collaboration: could not record ${target.type} of ${target.uri}: ${err.message}`));
}

/**
 * The data a conflicting client needs to merge: what's saved now, the same way
 * kiln loaded it (upgraded, but without render hooks).
 * @param {string} uri
 * @param {object} locals
 * @returns {Promise<{data: object|null, missing: boolean}>} rejects if it can't be read
 */
function currentData(uri, locals) {
  const quiet = Object.assign({}, locals, { hooks: 'false', extension: undefined });

  return Promise.resolve().then(() => {
    if (isPage(uri)) {
      return require('../services/db').get(uri);
    } else if (isComponent(uri)) {
      return require('../services/components').get(uri, quiet);
    } else {
      return require('../services/layouts').get(uri, quiet);
    }
  }).then(data => ({ data, missing: false }), (err) => {
    if (err.name === 'NotFoundError' || /not found/i.test(err.message)) {
      return { data: null, missing: true };
    }

    throw err;
  });
}

/**
 * 412: the client's edit is based on another revision. Send what's there now
 * (read after that revision was committed) so it can merge and retry, and the
 * current gap (a client that hadn't seen it yet has to re-read its page). If
 * the data can't be read, 503: an empty answer would make the client
 * overwrite it.
 * @param {object} res
 * @param {string} uri
 * @param {number} rev current revision
 * @param {string|null} gap current gap
 * @returns {Promise}
 */
function sendConflict(res, uri, rev, gap) {
  return currentData(uri, res.locals).then(({ data, missing }) => {
    res.set('Cache-Control', 'no-store');
    res.set('X-Clay-Rev', String(rev));
    res.status(412).json({
      code: 412,
      message: 'Precondition Failed: this was saved by someone else since you loaded it',
      uri,
      rev,
      gap,
      data,
      missing
    });
  }, () => {
    res.status(503).json({ code: 503, message: 'Could not check for changes from other editors; please try again' });
  });
}

/**
 * Reserve a uri for a write, waiting while another write to it is in flight.
 * @param {string} uri
 * @param {number|null} expected
 * @param {string} token
 * @returns {Promise<object>} the reservation; rejects if the store fails or the wait runs out
 */
function reserveWhenFree(uri, expected, token) {
  const giveUp = Date.now() + config.lockWait;

  function attempt() {
    return callStore(() => store.reserve(uri, expected, token)).then((result) => {
      if (!result.busy) {
        return result;
      }

      if (Date.now() > giveUp) {
        throw new Error(`${uri} has been busy for ${config.lockWait}ms`);
      }

      return new Promise(resolve => setTimeout(resolve, WAIT_STEP)).then(attempt);
    });
  }

  return attempt();
}

/**
 * Remember a write that went through without the store, to catch up on later.
 * @param {object} req
 * @param {object} site
 * @param {object} target
 */
function rememberUnguarded(req, site, target) {
  keepUnguarded({
    uri: target.uri,
    site: site.prefix,
    doc: documentFor(req, target.uri, site),
    // identity resolved at flush time would need the store; keep the raw parts
    event: { type: target.type, uri: target.uri, by: { session: null, user: null }, at: Date.now() }
  });
}

/**
 * Finish a reserved write: publish its revision (and event) if it worked, or
 * let go of the uri if it didn't.
 * @param {object} req
 * @param {object} res
 * @param {object} options
 * @param {object} options.site
 * @param {object} options.target
 * @param {object} options.reservation
 * @param {string} options.token
 */
function settle(req, res, { site, target, reservation, token }) {
  afterResponse(res, (finished) => {
    if (finished && res.statusCode >= 400) {
      callStore(() => store.release(target.uri, token)).catch(() => {});
    } else if (finished) {
      callStore(() => store.commit(target.uri, token, reservation.rev))
        .then(() => recordEvent(req, site, target, reservation.rev))
        .catch(() => rememberUnguarded(req, site, target));
    } else {
      // connection dropped: the write may still land, so publish its revision
      // a little later (a needless one only costs someone an extra merge)
      setTimeout(() => callStore(() => store.commit(target.uri, token, reservation.rev)).catch(() => {}), 2000).unref();
    }
  });
}

/**
 * The revision a write is checked against. A revision the client learned
 * before the current gap can't be trusted (data may have gone around the
 * store since, without moving it on), so the write is treated as "unknown":
 * the client gets the current data to merge with.
 * @param {object} req
 * @returns {Promise<{expected: number|null, gap: string|null}>} rejects if the store fails
 */
function expectedRevision(req) {
  const expected = parseRev(req.get(HEADERS.rev)),
    clientGap = req.get(HEADERS.gap);

  if (expected === null || !clientGap) {
    return Promise.resolve({ expected, gap: null });
  }

  return callStore(() => store.gap()).then(gap => ({ expected: gap === clientGap ? expected : -1, gap }));
}

/**
 * Revision check for a write that changes a component, layout or page.
 * @param {object} req
 * @param {object} res
 * @param {function} next
 * @param {object} options
 * @param {object} options.site
 * @param {object} options.target from classifyWrite
 */
function guardRevision(req, res, next, { site, target }) {
  const token = crypto.randomBytes(8).toString('hex');
  let gap = null;

  expectedRevision(req).then((check) => {
    gap = check.gap;

    return reserveWhenFree(target.uri, check.expected, token);
  }).then((reservation) => {
    if (!reservation.ok) {
      return sendConflict(res, target.uri, reservation.rev, gap);
    }

    res.set('X-Clay-Rev', String(reservation.rev));
    settle(req, res, { site, target, reservation, token });
    next();
  }, (err) => {
    log('warn', `collaboration: saving ${target.uri} without a revision check: ${err.message}`);
    rememberUnguarded(req, site, target);
    next();
  });
}

/**
 * Is this a collaborating client reading the latest data of a component,
 * layout or page?
 * @param {object} req
 * @param {object} site
 * @returns {boolean}
 */
function wantsReadRevision(req, site) {
  return req.method === 'GET'
    && !!req.get(HEADERS.session)
    && !!req.uri
    && req.uri.indexOf('@') === -1
    && isSiteContent(req.uri, site)
    && !/\/instances$|\/meta$|\/schema$/.test(req.uri);
}

/**
 * Tell a collaborating client which revision it's reading. Only committed
 * revisions are visible, and they're read before the data, so the revision is
 * never newer than what the client gets (at worst its next save merges once
 * more than needed).
 * @param {object} req
 * @param {object} res
 * @param {function} next
 * @param {object} site
 */
function addReadRevision(req, res, next, site) {
  const uri = req.uri;

  if (!wantsReadRevision(req, site)) {
    next();
    return;
  }

  callStore(() => store.revisions([uri])).then((revs) => {
    res.set('X-Clay-Rev', String(revs[uri]));
  }, () => {}).then(() => next());
}

/**
 * Record an unpublish or (un)schedule once it succeeds.
 * @param {object} req
 * @param {object} res
 * @param {object} site
 * @returns {boolean} whether the request was one
 */
function watchPageAction(req, res, site) {
  const action = req.uri && getPrefix(req.uri) === site.prefix && classifyPageAction(req.method, req.uri),
    doc = action && req.get(HEADERS.doc);

  if (!action || !doc || !isDocument(doc, site)) {
    return false;
  }

  afterResponse(res, (finished) => {
    if (finished && res.statusCode < 400) {
      recordEvent(req, site, Object.assign({ uri: doc }, action));
    }
  });

  return true;
}

/**
 * Middleware for every API request of a site: revision checks and change
 * feed for writes, revision headers for collaborating reads.
 * @param {object} site
 * @returns {function}
 */
function guard(site) {
  return function (req, res, next) {
    const target = req.uri && isSiteContent(req.uri, site) && classifyWrite(req.method, req.uri);

    if (!target && watchPageAction(req, res, site)) {
      return next();
    }

    if (!target) {
      return addReadRevision(req, res, next, site);
    }

    if (target.revision) {
      return guardRevision(req, res, next, { site, target });
    }

    afterResponse(res, (finished) => {
      if (finished && res.statusCode < 400) {
        recordEvent(req, site, target);
      }
    });
    next();
  };
}

/**
 * Settings kiln needs, embedded in edit-mode pages as locals.collaboration.
 * @param {number|null} cursor feed position the page was rendered at (null: unknown)
 * @param {string|null} gap the store's gap when the page was rendered (null: unknown)
 * @returns {object}
 */
function clientConfig(cursor, gap) {
  return {
    enabled: true,
    path: '/_collab',
    pollInterval: config.pollInterval,
    soloPollInterval: config.soloPollInterval,
    hiddenPollInterval: config.hiddenPollInterval,
    idlePollInterval: config.idlePollInterval,
    presenceTtl: config.presenceTtl,
    cursor,
    gap
  };
}

/**
 * When an editor opens a page in edit mode, hand kiln the collaboration
 * settings and the feed position the page was rendered at (so kiln catches
 * anything saved while the page was loading). If the store is unreachable,
 * kiln still gets the settings, without a position: it starts collaborating
 * as soon as the store is back, and treats what it loaded as unverified.
 * @param {object} site
 * @returns {function}
 */
function editLocals(site) {
  return function (req, res, next) {
    if (req.method !== 'GET' || !req.query.edit || !req.user || NON_PAGE_ROUTES.test(req.path)) {
      return next();
    }

    callStore(() => Promise.all([store.cursor(site.prefix), store.gap()])).then(([cursor, gap]) => {
      res.locals.collaboration = clientConfig(cursor, gap);
    }, (err) => {
      log('warn', `collaboration: rendering ${req.uri} without a feed position: ${err.message}`);
      res.locals.collaboration = clientConfig(null, null);
    }).then(() => next());
  };
}

/**
 * @param {*} value
 * @param {object} site
 * @returns {object|null} a valid focus, or null
 */
function parseFocus(value, site) {
  if (!value || typeof value !== 'object' || !isSiteContent(value.uri, site) || !SAFE_URI.test(value.uri)) {
    return null;
  }

  return {
    uri: value.uri,
    path: typeof value.path === 'string' && SAFE_PATH.test(value.path) ? value.path : null,
    label: typeof value.label === 'string' ? value.label.slice(0, 100) : null,
    typing: value.typing === true
  };
}

/**
 * Pages/layouts a client wants events for: its page, plus up to a few more.
 * @param {object} body
 * @param {object} site
 * @returns {string[]}
 */
function parseDocs(body, site) {
  const docs = Array.isArray(body.docs) ? body.docs.slice(0, 4) : [];

  return [body.page].concat(docs.filter(doc => doc !== body.page && isDocument(doc, site)));
}

/**
 * Uris a joining client wants revisions for.
 * @param {object} body
 * @param {object} site
 * @returns {string[]|null}
 */
function parseUris(body, site) {
  if (!Array.isArray(body.uris)) {
    return null;
  }

  return body.uris.slice(0, 5000).filter(uri => isSiteContent(uri, site) && uri.indexOf('@') === -1);
}

/**
 * Saves a client made that came back without a revision (they went through
 * while the store was unreachable), with the page or layout each belongs to.
 * @param {object} body
 * @param {object} site
 * @returns {object[]} [{ uri, doc }]
 */
function parseUnguarded(body, site) {
  if (!Array.isArray(body.unguarded)) {
    return [];
  }

  return body.unguarded.slice(0, MAX_REPORTED).filter((item) => {
    const target = item && typeof item.uri === 'string' && isSiteContent(item.uri, site) && SAFE_URI.test(item.uri) && classifyWrite('PUT', item.uri);

    return !!target && target.revision && target.uri === item.uri;
  }).map(({ uri, doc }) => {
    // pages and layouts are their own document, like any write (see documentFor)
    if (isDocument(uri, site)) {
      return { uri, doc: uri };
    }

    return { uri, doc: isDocument(doc, site) ? doc : body.page };
  });
}

/**
 * @param {*} cursor
 * @returns {number|null}
 */
function parseCursor(cursor) {
  return Number.isInteger(cursor) && cursor >= 0 ? cursor : null;
}

/**
 * Validate a sync/leave request body.
 * @param {object} body
 * @param {object} site
 * @returns {object|null}
 */
function parseSyncRequest(body, site) {
  if (!body || !isPage(String(body.page)) || !isDocument(body.page, site) || !SESSION_PATTERN.test(body.session || '')) {
    return null;
  }

  return {
    page: body.page,
    session: body.session,
    docs: parseDocs(body, site),
    cursor: parseCursor(body.cursor),
    epoch: typeof body.epoch === 'string' ? body.epoch : null,
    focus: parseFocus(body.focus, site),
    state: STATES.indexOf(body.state) > -1 ? body.state : 'active',
    uris: parseUris(body, site),
    unguarded: parseUnguarded(body, site)
  };
}

/**
 * Presence is stored per user + tab, so an editor can only ever update or
 * remove their own entry.
 * @param {object} user
 * @param {string} session
 * @param {string} secret
 * @returns {string}
 */
function presenceKey(user, session, secret) {
  return `${userId(user, secret)}:${session}`;
}

/**
 * Does the client have to start over (re-learn revisions, re-read changes)?
 * When the store's data was lost (new epoch), its cursor is from a different
 * sequence (ahead of ours), or events it hasn't seen were dropped from a feed.
 * @param {object} params
 * @param {object} state { epoch, seq, start }
 * @returns {boolean}
 */
function needsResync(params, { epoch, seq, start }) {
  if (params.cursor === null) {
    return false;
  }

  return !!params.epoch && params.epoch !== epoch || params.cursor > seq || start > 0 && params.cursor < start - 1;
}

/**
 * What the client sees: other tabs as opaque ids (never their session), and
 * which entries/events are its own.
 * @param {object} result from store.sync
 * @param {string} key the client's presence key
 * @param {string} session the client's session
 * @param {string} secret
 * @returns {{presence: object[], events: object[]}}
 */
function forClient(result, key, session, secret) {
  return {
    presence: result.presence.map(entry => ({
      tab: tabId(entry.key, secret),
      self: entry.key === key,
      user: entry.user,
      focus: entry.focus,
      state: entry.state
    })),
    events: result.events.sort((a, b) => a.id - b.id).map(event => Object.assign({}, event, {
      by: { user: event.by && event.by.user, own: !!event.by && event.by.session === session }
    }))
  };
}

/**
 * Saves a client reports went through without the store: move their
 * revisions forward and tell everyone now. The instance that made them
 * normally does this itself once the store is back, but it may have stopped
 * (deploy, crash) and forgotten them; the editor's tab remembers.
 * @param {object} req
 * @param {object} site
 * @param {object} params
 * @param {string} secret
 * @returns {Promise}
 */
function catchUpReported(req, site, params, secret) {
  const by = { session: params.session, user: publicIdentity(req.user, secret) };

  return Promise.all(params.unguarded.map(({ uri, doc }) => callStore(() => store.bump(uri))
    .then(rev => callStore(() => store.append(site.prefix, doc, { type: 'save', uri, by, at: Date.now(), rev })))));
}

/**
 * Read the store for a sync.
 * @param {object} req
 * @param {object} site
 * @param {object} params
 * @returns {Promise<object>}
 */
function readSync(req, site, params) {
  return callStore(() => Promise.all([store.salt(), store.epoch(), store.cursor(site.prefix), store.gap()])).then(([secret, epoch, seq, gap]) => {
    const key = presenceKey(req.user, params.session, secret),
      ttl = params.state === 'hidden' ? config.hiddenPresenceTtl : config.presenceTtl;

    return catchUpReported(req, site, params, secret).then(() => callStore(() => Promise.all([
      store.sync({
        page: params.page,
        docs: params.docs,
        key,
        entry: { user: publicIdentity(req.user, secret), focus: params.focus, state: params.state },
        expires: Date.now() + ttl,
        cursor: params.cursor === null ? Number.MAX_SAFE_INTEGER : params.cursor
      }),
      params.uris ? store.revisions(params.uris) : null
    ]))).then(([result, revs]) => ({ result, revs, secret, epoch, seq, gap, key }));
  });
}

/**
 * POST /_collab/sync — heartbeat + presence + changes since `cursor`.
 *
 * Request: { page, session, docs?: [layoutUri], cursor, epoch?, focus?, state?, uris?, unguarded? }
 *   `uris` (first sync, or after a resync) asks for the current revision of
 *   every component on the page. `unguarded` ([{ uri, doc }]) lists the
 *   client's saves that came back without a revision.
 * Response: { now, epoch, gap, cursor, resync, pollInterval, hiddenPollInterval, presence, events, revs? }
 *   `gap` changes whenever writes may have gone around the store (it was
 *   unreachable): a client that sees it change re-reads what it has.
 * @param {object} site
 * @returns {function}
 */
function handleSync(site) {
  return function (req, res) {
    const params = parseSyncRequest(req.body, site);

    if (!params) {
      return res.status(400).json({ code: 400, message: 'Invalid collaboration sync request' });
    }

    readSync(req, site, params).then(({ result, revs, secret, epoch, seq, gap, key }) => {
      const resync = needsResync(params, { epoch, seq, start: result.start }),
        visible = forClient(result, key, params.session, secret),
        events = resync ? [] : visible.events,
        cursor = resync || params.cursor === null ? seq : events.reduce((max, event) => Math.max(max, event.id), params.cursor),
        body = {
          now: Date.now(),
          epoch,
          gap,
          cursor,
          resync,
          pollInterval: config.pollInterval,
          hiddenPollInterval: config.hiddenPollInterval,
          presence: visible.presence,
          events
        };

      if (revs) {
        body.revs = revs;
      }

      res.set('Cache-Control', 'no-store');
      res.json(body);
    }).catch((err) => {
      log('warn', `collaboration sync failed: ${err.message}`);
      res.status(503).json({ code: 503, message: 'Collaboration is unavailable' });
    });
  };
}

/**
 * POST /_collab/leave — an editor closed the page (sent with sendBeacon).
 * @param {object} site
 * @returns {function}
 */
function handleLeave(site) {
  return function (req, res) {
    const params = parseSyncRequest(req.body, site);

    if (!params) {
      return res.status(400).json({ code: 400, message: 'Invalid collaboration leave request' });
    }

    callStore(() => store.salt())
      .then(secret => callStore(() => store.leave(params.page, presenceKey(req.user, params.session, secret))))
      .catch(err => log('warn', `collaboration leave failed: ${err.message}`))
      .then(() => res.status(204).end());
  };
}

/**
 * Only logged-in editors, and only from pages on this site (another site
 * can't post presence on an editor's behalf).
 * @param {object} req
 * @param {object} res
 * @param {function} next
 */
function requireEditor(req, res, next) {
  const origin = req.get('origin');
  let sameOrigin = true;

  if (origin) {
    try {
      // req.hostname honors X-Forwarded-Host behind a trusted proxy
      sameOrigin = new URL(origin).hostname === req.hostname;
    } catch (e) {
      sameOrigin = false;
    }
  }

  if (!req.user) {
    res.status(401).json({ code: 401, message: 'Unauthorized' });
  } else if (!sameOrigin) {
    res.status(403).json({ code: 403, message: 'Forbidden' });
  } else {
    next();
  }
}

/**
 * Mount collaboration on a site's router. Must come after authentication and
 * after amphora's locals (query params) middleware, and before the API routes.
 * @param {express.Router} siteRouter
 * @param {object} site
 */
function attach(siteRouter, site) {
  const router = express.Router();

  router.post('/sync', requireEditor, bodyParser.json({ strict: true, type: 'application/json', limit: '512kb' }), handleSync(site));
  // sendBeacon posts the leave message as text/plain
  router.post('/leave', requireEditor, bodyParser.json({ strict: true, type: ['application/json', 'text/plain'], limit: '16kb' }), handleLeave(site));

  siteRouter.use(editLocals(site));
  siteRouter.use('/_collab', router);
  siteRouter.use(guard(site));
}

module.exports.configure = configure;
module.exports.isEnabled = isEnabled;
module.exports.attach = attach;
module.exports.HEADERS = HEADERS;
module.exports.DEFAULTS = DEFAULTS;

// For testing
module.exports.classifyWrite = classifyWrite;
module.exports.classifyPageAction = classifyPageAction;
module.exports.parseRev = parseRev;
module.exports.parseSyncRequest = parseSyncRequest;
module.exports.parseUnguarded = parseUnguarded;
module.exports.needsResync = needsResync;
module.exports.getStore = () => store;
module.exports.setLog = mock => log = mock;
