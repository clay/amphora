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
 * unguarded and pages render without collaboration, exactly as before.
 */

const express = require('express'),
  bodyParser = require('body-parser'),
  { getPrefix, isComponent, isLayout, isPage, replaceVersion } = require('clayutils'),
  MemoryStore = require('./stores/memory'),
  RedisStore = require('./stores/redis'),
  { publicIdentity, userId } = require('./identity'),
  HEADERS = {
    session: 'x-clay-collab-session', // the editor tab making the request
    doc: 'x-clay-collab-doc', // page or layout the change belongs to
    rev: 'x-clay-rev' // request: revision the edit is based on; response: revision after the write
  },
  DEFAULTS = {
    keyPrefix: 'clay:collab',
    pollInterval: 2000, // ms between syncs while others are on the page
    soloPollInterval: 5000, // ms between syncs while nobody else is
    hiddenPollInterval: 20000, // ms between syncs while the tab is in the background
    idlePollInterval: 30000, // ms between syncs after 5 minutes without input
    presenceTtl: 45000, // ms without a sync before an editor is shown as gone (longer than the slowest poll)
    feedSize: 200, // events kept per page/layout
    feedTtl: 3600, // seconds a quiet feed is kept
    revisionTtl: 7 * 24 * 3600, // seconds an untouched revision is kept
    timeout: 500 // ms to wait for the store before carrying on without it
  },
  SESSION_PATTERN = /^[A-Za-z0-9_-]{8,64}$/,
  STATES = ['active', 'idle', 'hidden'],
  NOT_WRITES = ['GET', 'HEAD', 'OPTIONS', 'POST'],
  // versions whose writes are events for editors: [on PUT, on DELETE]
  VERSION_EVENTS = { published: ['publish', 'unpublish'], scheduled: ['schedule', 'unschedule'] },
  NON_PAGE_ROUTES = /^\/_(components|layouts|lists|uris|users|auth|collab|schedule)(\/|$)/;
let log = require('../services/logger').setup({ file: __filename }),
  config = null,
  store = null;

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
 * Create the store from the options.
 * @param {object} options
 * @returns {object}
 */
function createStore(options) {
  if (options.store) {
    return options.store;
  }

  if (options.redis) {
    return new RedisStore(Object.assign({}, options, {
      onError: err => log('warn', `collaboration redis error: ${err.message}`)
    }));
  }

  if (process.env.NODE_ENV === 'production') {
    log('warn', 'Collaboration is using the in-memory store: editors on different instances will not see each other. Pass `collaboration.redis`.');
  }

  return new MemoryStore(options);
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

  if (!options || options.enabled === false) {
    return null;
  }

  config = Object.assign({}, DEFAULTS, options === true ? {} : options);
  store = createStore(config);
  log('info', `Collaboration enabled (${storeName(config)} store)`);

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
 * @returns {number|null} null when absent or invalid (write is unconditional)
 */
function parseRev(value) {
  const rev = Number(value);

  return value !== undefined && value !== '' && Number.isInteger(rev) && rev >= 0 ? rev : null;
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
 * True for uris of this site's components, layouts and pages.
 * @param {string} uri
 * @param {object} site
 * @returns {boolean}
 */
function isSiteContent(uri, site) {
  return typeof uri === 'string' && (isComponent(uri) || isLayout(uri) || isPage(uri)) && getPrefix(uri) === site.prefix;
}

/**
 * True for page and layout instance uris of this site (the "documents" whose
 * feeds editors follow).
 * @param {string} uri
 * @param {object} site
 * @returns {boolean}
 */
function isDocument(uri, site) {
  return isSiteContent(uri, site) && !isComponent(uri) && (isPage(uri) || /\/_layouts\/[^/]+\/instances\/[^/@]+$/.test(uri));
}

/**
 * Which document feed a write goes to: the one kiln names, or the page/layout
 * itself when that's what was written. Writes from other clients (scripts,
 * importers) have no document; they still get revisions, so kiln can't
 * overwrite them, they just don't show up live.
 * @param {object} req
 * @param {string} uri
 * @param {object} site
 * @returns {string|null}
 */
function documentFor(req, uri, site) {
  const doc = req.get(HEADERS.doc);

  if (doc && isDocument(doc, site)) {
    return doc;
  }

  return isDocument(uri, site) ? uri : null;
}

/**
 * Run `fn` once the response has been sent.
 * @param {object} res
 * @param {function} fn
 */
function afterResponse(res, fn) {
  res.once('finish', fn);
}

/**
 * Record a successful write in its document's feed.
 * @param {object} req
 * @param {object} site
 * @param {object} target from classifyWrite
 * @param {number} [rev]
 */
function recordEvent(req, site, target, rev) {
  const doc = documentFor(req, target.uri, site),
    session = req.get(HEADERS.session),
    event = {
      type: target.type,
      uri: target.uri,
      by: {
        session: SESSION_PATTERN.test(session || '') ? session : null,
        user: req.user ? publicIdentity(req.user) : null
      },
      at: Date.now()
    };

  if (!doc) {
    return;
  }

  if (rev) {
    event.rev = rev;
  }

  store.append(site.prefix, doc, event).catch(err => log('warn', `collaboration: could not record ${target.type} of ${target.uri}: ${err.message}`));
}

/**
 * The data a conflicting client needs to merge: what's saved now, the same way
 * kiln loaded it (upgraded, but without render hooks).
 * @param {string} uri
 * @param {object} locals
 * @returns {Promise<object|null>}
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
  }).catch(() => null);
}

/**
 * 412: the client's edit is based on an old revision. Send what's there now
 * so it can merge and retry.
 * @param {object} res
 * @param {string} uri
 * @param {number} rev current revision
 * @returns {Promise}
 */
function sendConflict(res, uri, rev) {
  return currentData(uri, res.locals).then((data) => {
    res.set('Cache-Control', 'no-store');
    res.set('X-Clay-Rev', String(rev));
    res.status(412).json({
      code: 412,
      message: 'Precondition Failed: this was saved by someone else since you loaded it',
      uri,
      rev,
      data
    });
  });
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
  const expected = parseRev(req.get(HEADERS.rev));

  withTimeout(store.reserve(target.uri, expected), config.timeout).then((result) => {
    if (!result.ok) {
      return sendConflict(res, target.uri, result.rev);
    }

    res.set('X-Clay-Rev', String(result.rev));
    afterResponse(res, () => {
      if (res.statusCode >= 400) {
        store.release(target.uri, result.rev, result.prev).catch(() => {});
      } else {
        recordEvent(req, site, target, result.rev);
      }
    });
    next();
  }, (err) => {
    log('warn', `collaboration: saving ${target.uri} without a revision check: ${err.message}`);
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
 * Tell a collaborating client which revision it's reading. Read before the
 * data, so the revision is never newer than what the client gets (at worst
 * its next save merges once more than needed).
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

  withTimeout(store.revisions([uri]), config.timeout).then((revs) => {
    res.set('X-Clay-Rev', String(revs[uri]));
  }, () => {}).then(() => next());
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

    if (!target) {
      return addReadRevision(req, res, next, site);
    }

    if (target.revision) {
      return guardRevision(req, res, next, { site, target });
    }

    afterResponse(res, () => {
      if (res.statusCode < 400) {
        recordEvent(req, site, target);
      }
    });
    next();
  };
}

/**
 * Settings kiln needs, embedded in edit-mode pages as locals.collaboration.
 * @param {object} site
 * @param {number} cursor
 * @returns {object}
 */
function clientConfig(site, cursor) {
  return {
    enabled: true,
    path: '/_collab',
    pollInterval: config.pollInterval,
    soloPollInterval: config.soloPollInterval,
    hiddenPollInterval: config.hiddenPollInterval,
    idlePollInterval: config.idlePollInterval,
    presenceTtl: config.presenceTtl,
    cursor
  };
}

/**
 * When an editor opens a page in edit mode, hand kiln the collaboration
 * settings and the feed position the page was rendered at (so kiln catches
 * anything saved while the page was loading).
 * @param {object} site
 * @returns {function}
 */
function editLocals(site) {
  return function (req, res, next) {
    if (req.method !== 'GET' || !req.query.edit || !req.user || NON_PAGE_ROUTES.test(req.path)) {
      return next();
    }

    withTimeout(store.cursor(site.prefix), config.timeout).then((cursor) => {
      res.locals.collaboration = clientConfig(site, cursor);
    }, (err) => {
      log('warn', `collaboration: rendering ${req.uri} without collaboration: ${err.message}`);
    }).then(() => next());
  };
}

/**
 * @param {*} value
 * @param {object} site
 * @returns {object|null} a valid focus, or null
 */
function parseFocus(value, site) {
  if (!value || typeof value !== 'object' || !isSiteContent(value.uri, site)) {
    return null;
  }

  return {
    uri: value.uri,
    path: typeof value.path === 'string' ? value.path.slice(0, 200) : null,
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
    focus: parseFocus(body.focus, site),
    state: STATES.indexOf(body.state) > -1 ? body.state : 'active',
    uris: parseUris(body, site)
  };
}

/**
 * Presence is stored per user + tab, so an editor can only ever update or
 * remove their own entry.
 * @param {object} user
 * @param {string} session
 * @returns {string}
 */
function presenceKey(user, session) {
  return `${userId(user)}:${session}`;
}

/**
 * POST /_collab/sync — heartbeat + presence + changes since `cursor`.
 *
 * Request: { page, session, docs?: [layoutUri], cursor, focus?, state?, uris? }
 *   `uris` (first sync only) asks for the current revision of every component
 *   on the page.
 * Response: { now, cursor, pollInterval, hiddenPollInterval, presence: [...], events: [...], revs? }
 * @param {object} site
 * @returns {function}
 */
function handleSync(site) {
  return function (req, res) {
    const params = parseSyncRequest(req.body, site);

    if (!params) {
      return res.status(400).json({ code: 400, message: 'Invalid collaboration sync request' });
    }

    Promise.all([
      store.sync({
        page: params.page,
        docs: params.docs,
        session: presenceKey(req.user, params.session),
        entry: { session: params.session, user: publicIdentity(req.user), focus: params.focus, state: params.state },
        cursor: params.cursor === null ? Number.MAX_SAFE_INTEGER : params.cursor,
        presenceTtl: config.presenceTtl
      }),
      params.uris ? store.revisions(params.uris) : null,
      params.cursor === null ? store.cursor(site.prefix) : null
    ]).then(([{ presence, events }, revs, start]) => {
      const sorted = events.sort((a, b) => a.id - b.id),
        cursor = sorted.reduce((max, event) => Math.max(max, event.id), params.cursor === null ? start : params.cursor),
        body = {
          now: Date.now(),
          cursor,
          pollInterval: config.pollInterval,
          hiddenPollInterval: config.hiddenPollInterval,
          presence,
          events: sorted
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

    store.leave(params.page, presenceKey(req.user, params.session))
      .catch(err => log('warn', `collaboration leave failed: ${err.message}`))
      .then(() => res.status(204).end());
  };
}

/**
 * @param {object} req
 * @param {object} res
 * @param {function} next
 */
function requireUser(req, res, next) {
  if (req.user) {
    next();
  } else {
    res.status(401).json({ code: 401, message: 'Unauthorized' });
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

  // sendBeacon posts the leave message as text/plain
  router.use(bodyParser.json({ strict: true, type: ['application/json', 'text/plain'], limit: '512kb' }));
  router.post('/sync', requireUser, handleSync(site));
  router.post('/leave', requireUser, handleLeave(site));

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
module.exports.parseRev = parseRev;
module.exports.parseSyncRequest = parseSyncRequest;
module.exports.getStore = () => store;
module.exports.setLog = mock => log = mock;
