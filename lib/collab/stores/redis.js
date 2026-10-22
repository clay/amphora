'use strict';

// Each multi-step operation runs as one Lua script, so it's atomic across every
// amphora instance sharing the Redis and costs a single round trip.

const crypto = require('crypto'),
  Redis = require('ioredis'),
  { getPrefix } = require('clayutils'),
  // KEYS[1] revision, KEYS[2] lock; ARGV: expected ('' = unconditional), token, lock ttl ms
  // -> {1 ok | 0 conflict | 2 busy, rev, prev}. The lock holds "<token> <rev>".
  RESERVE = `
if redis.call('EXISTS', KEYS[2]) == 1 then
  return {2, 0, 0}
end
local cur = tonumber(redis.call('GET', KEYS[1]) or '0')
if ARGV[1] ~= '' and tonumber(ARGV[1]) ~= cur then
  return {0, cur, cur}
end
redis.call('SET', KEYS[2], ARGV[2] .. ' ' .. (cur + 1), 'PX', ARGV[3])
return {1, cur + 1, cur}
`,
  // KEYS[1] revision, KEYS[2] lock; ARGV: token, rev, revision ttl seconds
  COMMIT = `
local lock = redis.call('GET', KEYS[2])
if lock and string.sub(lock, 1, #ARGV[1] + 1) == ARGV[1] .. ' ' then
  redis.call('DEL', KEYS[2])
end
if tonumber(redis.call('GET', KEYS[1]) or '0') < tonumber(ARGV[2]) then
  redis.call('SET', KEYS[1], ARGV[2], 'EX', ARGV[3])
end
return 1
`,
  // KEYS[1] lock; ARGV: token
  RELEASE = `
local lock = redis.call('GET', KEYS[1])
if lock and string.sub(lock, 1, #ARGV[1] + 1) == ARGV[1] .. ' ' then
  redis.call('DEL', KEYS[1])
end
return 1
`,
  // KEYS[1] revision; ARGV: revision ttl seconds
  BUMP = `
local rev = tonumber(redis.call('GET', KEYS[1]) or '0') + 1
redis.call('SET', KEYS[1], rev, 'EX', ARGV[1])
return rev
`,
  // KEYS[1] site sequence, KEYS[2] document feed, KEYS[3] feed start marker
  // ARGV: event json, feed size, ttl seconds. Entries are "<id> <json>".
  APPEND = `
local id = redis.call('INCR', KEYS[1])
redis.call('LPUSH', KEYS[2], id .. ' ' .. ARGV[1])
local size = tonumber(ARGV[2])
if redis.call('LLEN', KEYS[2]) > size then
  redis.call('LTRIM', KEYS[2], 0, size - 1)
  local oldest = redis.call('LINDEX', KEYS[2], -1)
  redis.call('SET', KEYS[3], string.sub(oldest, 1, string.find(oldest, ' ', 1, true) - 1), 'EX', ARGV[3])
end
redis.call('EXPIRE', KEYS[2], ARGV[3])
return id
`,
  // KEYS[1] presence hash, then pairs of (feed, feed start marker)
  // ARGV: key, entry json ('' = read only), now ms, expires ms, presence key ttl seconds, cursor, feed size
  // Presence values are "<expires ms> <json>".
  SYNC = `
local now = tonumber(ARGV[3])
if ARGV[2] ~= '' then
  redis.call('HSET', KEYS[1], ARGV[1], ARGV[4] .. ' ' .. ARGV[2])
  redis.call('EXPIRE', KEYS[1], ARGV[5])
end
local presence = {}
local all = redis.call('HGETALL', KEYS[1])
for i = 1, #all, 2 do
  local value = all[i + 1]
  local sep = string.find(value, ' ', 1, true)
  if tonumber(string.sub(value, 1, sep - 1)) < now then
    redis.call('HDEL', KEYS[1], all[i])
  else
    table.insert(presence, all[i])
    table.insert(presence, string.sub(value, sep + 1))
  end
end
local cursor = tonumber(ARGV[6])
local events = {}
local start = 0
for k = 2, #KEYS, 2 do
  local items = redis.call('LRANGE', KEYS[k], 0, tonumber(ARGV[7]) - 1)
  for j = 1, #items do
    local sep = string.find(items[j], ' ', 1, true)
    if tonumber(string.sub(items[j], 1, sep - 1)) <= cursor then
      break
    end
    table.insert(events, items[j])
  end
  local marker = tonumber(redis.call('GET', KEYS[k + 1]) or '0')
  if marker > start then
    start = marker
  end
end
return {presence, events, start}
`;

/**
 * Split a "<number> <json>" entry.
 * @param {string} value
 * @returns {{n: number, data: object}}
 */
function parseEntry(value) {
  const sep = value.indexOf(' ');

  return { n: Number(value.slice(0, sep)), data: JSON.parse(value.slice(sep + 1)) };
}

/**
 * Collaboration store shared by every amphora instance through Redis.
 * Same interface as MemoryStore.
 */
class RedisStore {
  /**
   * @param {object} options
   * @param {string|object} options.redis Redis URL, or an ioredis client to reuse
   * @param {string} options.keyPrefix prefix for every key
   * @param {number} options.feedSize events kept per document
   * @param {number} options.feedTtl seconds an idle feed is kept
   * @param {number} options.revisionTtl seconds an untouched revision is kept
   * @param {number} options.lockTtl ms a write may hold a uri
   * @param {number} options.hiddenPresenceTtl ms the longest a presence entry lives
   * @param {function} [options.now] clock, for tests
   * @param {function} [options.onError] called with connection errors
   */
  constructor({ redis, keyPrefix, feedSize, feedTtl, revisionTtl, lockTtl, hiddenPresenceTtl, now = Date.now, onError }) {
    this.ownsClient = typeof redis === 'string';
    // commands queue briefly while (re)connecting, but give up after one retry:
    // callers time out after a fraction of a second anyway and carry on without us
    this.client = this.ownsClient ? new Redis(redis, { maxRetriesPerRequest: 1 }) : redis;
    this.prefix = keyPrefix;
    this.feedSize = feedSize;
    this.feedTtl = feedTtl;
    this.revisionTtl = revisionTtl;
    this.lockTtl = lockTtl;
    this.presenceKeyTtl = Math.ceil(hiddenPresenceTtl * 2 / 1000);
    this.now = now;
    this.cache = {};

    if (this.ownsClient && onError) {
      this.client.on('error', onError);
    }

    this.client.defineCommand('collabReserve', { numberOfKeys: 2, lua: RESERVE });
    this.client.defineCommand('collabCommit', { numberOfKeys: 2, lua: COMMIT });
    this.client.defineCommand('collabRelease', { numberOfKeys: 1, lua: RELEASE });
    this.client.defineCommand('collabBump', { numberOfKeys: 1, lua: BUMP });
    this.client.defineCommand('collabAppend', { numberOfKeys: 3, lua: APPEND });
    this.client.defineCommand('collabSync', { lua: SYNC });
  }

  /**
   * Every key of a site shares a hash tag, so the multi-key scripts also work
   * on Redis Cluster (all of a site's keys live in one slot).
   * @param {string} kind
   * @param {string} id uri, or site prefix for the site sequence
   * @returns {string}
   */
  key(kind, id) {
    const site = kind === 'seq' ? id : getPrefix(id);

    return `${this.prefix}:{${site}}:${kind}:${id}`;
  }

  /**
   * @param {string} uri
   * @param {number|null} expected null = unconditional, -1 = always conflict
   * @param {string} token
   * @returns {Promise<{ok: boolean, busy: boolean, rev: number, prev: number}>}
   */
  reserve(uri, expected, token) {
    return this.client.collabReserve(this.key('rev', uri), this.key('lock', uri), expected === null ? '' : String(expected), token, this.lockTtl)
      .then(([status, rev, prev]) => ({ ok: status === 1, busy: status === 2, rev, prev }));
  }

  /**
   * @param {string} uri
   * @param {string} token
   * @param {number} rev
   * @returns {Promise}
   */
  commit(uri, token, rev) {
    return this.client.collabCommit(this.key('rev', uri), this.key('lock', uri), token, rev, this.revisionTtl);
  }

  /**
   * @param {string} uri
   * @param {string} token
   * @returns {Promise}
   */
  release(uri, token) {
    return this.client.collabRelease(this.key('lock', uri), token);
  }

  /**
   * @param {string} uri
   * @returns {Promise<number>}
   */
  bump(uri) {
    return this.client.collabBump(this.key('rev', uri), this.revisionTtl).then(Number);
  }

  /**
   * @param {string[]} uris
   * @returns {Promise<object>}
   */
  revisions(uris) {
    if (!uris.length) {
      return Promise.resolve({});
    }

    return this.client.mget(uris.map(uri => this.key('rev', uri))).then((values) => {
      const result = {};

      uris.forEach((uri, i) => { result[uri] = Number(values[i]) || 0; });

      return result;
    });
  }

  /**
   * A random value shared by every instance, created on first use. If Redis
   * loses its data, a new one is created, which is how clients notice.
   * @param {string} name
   * @returns {Promise<string>}
   */
  shared(name) {
    const key = `${this.prefix}:${name}`;

    return this.client.set(key, crypto.randomBytes(16).toString('hex'), 'NX')
      .then(() => this.client.get(key));
  }

  /**
   * @returns {Promise<string>}
   */
  epoch() {
    return this.shared('epoch');
  }

  /**
   * @returns {Promise<string>}
   */
  gap() {
    return this.shared('gap');
  }

  /**
   * @returns {Promise<string>}
   */
  newGap() {
    const value = crypto.randomBytes(16).toString('hex');

    return this.client.set(`${this.prefix}:gap`, value).then(() => value);
  }

  /**
   * @param {number} now ms
   * @returns {Promise<number|null>} the previous stamp
   */
  beat(now) {
    return this.client.getset(`${this.prefix}:beat`, String(now)).then(previous => previous ? Number(previous) : null);
  }

  /**
   * @returns {Promise<string>}
   */
  salt() {
    if (!this.cache.salt) {
      this.cache.salt = this.shared('salt').catch((err) => {
        delete this.cache.salt;
        throw err;
      });
    }

    return this.cache.salt;
  }

  /**
   * @param {string} site
   * @returns {Promise<number>}
   */
  cursor(site) {
    return this.client.get(this.key('seq', site)).then(value => Number(value) || 0);
  }

  /**
   * @param {string} site
   * @param {string} doc
   * @param {object} event
   * @returns {Promise<number>}
   */
  append(site, doc, event) {
    return this.client.collabAppend(this.key('seq', site), this.key('feed', doc), this.key('start', doc), JSON.stringify(event), this.feedSize, this.feedTtl)
      .then(Number);
  }

  /**
   * @param {object} options see MemoryStore#sync
   * @returns {Promise<{presence: object[], events: object[], start: number}>}
   */
  sync({ page, docs, key, entry, expires, cursor }) {
    const keys = [this.key('presence', page)].concat(...docs.map(doc => [this.key('feed', doc), this.key('start', doc)]));

    return this.client.collabSync(keys.length, ...keys, key, entry ? JSON.stringify(entry) : '', this.now(), expires || 0, this.presenceKeyTtl, cursor, this.feedSize)
      .then(([presence, events, start]) => {
        const entries = [];

        for (let i = 0; i < presence.length; i += 2) {
          entries.push(Object.assign(JSON.parse(presence[i + 1]), { key: presence[i] }));
        }

        return {
          presence: entries,
          events: events.map(parseEntry).map(({ n, data }) => Object.assign({ id: n }, data)),
          start: Number(start) || 0
        };
      });
  }

  /**
   * @param {string} page
   * @param {string} key
   * @returns {Promise}
   */
  leave(page, key) {
    return this.client.hdel(this.key('presence', page), key);
  }

  /**
   * @returns {Promise}
   */
  close() {
    return this.ownsClient ? this.client.quit() : Promise.resolve();
  }
}

module.exports = RedisStore;
module.exports.parseEntry = parseEntry;
