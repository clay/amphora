'use strict';

// Each multi-step operation runs as one Lua script, so it's atomic across every
// amphora instance sharing the Redis and costs a single round trip.

const Redis = require('ioredis'),
  { getPrefix } = require('clayutils'),
  // KEYS[1] revision key; ARGV: expected ('' = unconditional), ttl seconds
  RESERVE = `
local cur = tonumber(redis.call('GET', KEYS[1]) or '0')
if ARGV[1] ~= '' and tonumber(ARGV[1]) ~= cur then
  return {0, cur, cur}
end
redis.call('SET', KEYS[1], cur + 1, 'EX', ARGV[2])
return {1, cur + 1, cur}
`,
  // KEYS[1] revision key; ARGV: reserved, prev, ttl seconds
  RELEASE = `
if tonumber(redis.call('GET', KEYS[1]) or '0') == tonumber(ARGV[1]) then
  if tonumber(ARGV[2]) == 0 then
    redis.call('DEL', KEYS[1])
  else
    redis.call('SET', KEYS[1], ARGV[2], 'EX', ARGV[3])
  end
end
return 1
`,
  // KEYS[1] site sequence, KEYS[2] document feed; ARGV: event json, feed size, ttl seconds
  // Entries are stored as "<id> <json>" so the id never has to be spliced into JSON.
  APPEND = `
local id = redis.call('INCR', KEYS[1])
redis.call('LPUSH', KEYS[2], id .. ' ' .. ARGV[1])
redis.call('LTRIM', KEYS[2], 0, tonumber(ARGV[2]) - 1)
redis.call('EXPIRE', KEYS[2], ARGV[3])
return id
`,
  // KEYS[1] presence hash, KEYS[2..n] document feeds
  // ARGV: session, entry json ('' = read only), now ms, presence ttl ms, presence key ttl seconds, cursor, feed size
  // Presence values are stored as "<ts> <json>".
  SYNC = `
local now = tonumber(ARGV[3])
if ARGV[2] ~= '' then
  redis.call('HSET', KEYS[1], ARGV[1], now .. ' ' .. ARGV[2])
  redis.call('EXPIRE', KEYS[1], ARGV[5])
end
local presence = {}
local all = redis.call('HGETALL', KEYS[1])
for i = 1, #all, 2 do
  local value = all[i + 1]
  local sep = string.find(value, ' ', 1, true)
  local ts = tonumber(string.sub(value, 1, sep - 1))
  if ts < now - tonumber(ARGV[4]) then
    redis.call('HDEL', KEYS[1], all[i])
  else
    table.insert(presence, value)
  end
end
local cursor = tonumber(ARGV[6])
local events = {}
for k = 2, #KEYS do
  local items = redis.call('LRANGE', KEYS[k], 0, tonumber(ARGV[7]) - 1)
  for j = 1, #items do
    local sep = string.find(items[j], ' ', 1, true)
    if tonumber(string.sub(items[j], 1, sep - 1)) <= cursor then
      break
    end
    table.insert(events, items[j])
  end
end
return {presence, events}
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
   * @param {number} options.presenceTtl ms before a silent session is dropped
   * @param {function} [options.now] clock, for tests
   * @param {function} [options.onError] called with connection errors
   */
  constructor({ redis, keyPrefix, feedSize, feedTtl, revisionTtl, presenceTtl, now = Date.now, onError }) {
    this.ownsClient = typeof redis === 'string';
    // commands queue briefly while (re)connecting, but give up after one retry:
    // callers time out after a fraction of a second anyway and carry on without us
    this.client = this.ownsClient ? new Redis(redis, { maxRetriesPerRequest: 1 }) : redis;
    this.prefix = keyPrefix;
    this.feedSize = feedSize;
    this.feedTtl = feedTtl;
    this.revisionTtl = revisionTtl;
    this.presenceKeyTtl = Math.ceil(presenceTtl * 4 / 1000);
    this.now = now;

    if (this.ownsClient && onError) {
      this.client.on('error', onError);
    }

    this.client.defineCommand('collabReserve', { numberOfKeys: 1, lua: RESERVE });
    this.client.defineCommand('collabRelease', { numberOfKeys: 1, lua: RELEASE });
    this.client.defineCommand('collabAppend', { numberOfKeys: 2, lua: APPEND });
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
   * @param {number|null} expected
   * @returns {Promise<{ok: boolean, rev: number, prev: number}>}
   */
  reserve(uri, expected) {
    return this.client.collabReserve(this.key('rev', uri), expected === null ? '' : String(expected), this.revisionTtl)
      .then(([ok, rev, prev]) => ({ ok: ok === 1, rev, prev }));
  }

  /**
   * @param {string} uri
   * @param {number} reserved
   * @param {number} prev
   * @returns {Promise}
   */
  release(uri, reserved, prev) {
    return this.client.collabRelease(this.key('rev', uri), reserved, prev, this.revisionTtl);
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
    return this.client.collabAppend(this.key('seq', site), this.key('feed', doc), JSON.stringify(event), this.feedSize, this.feedTtl)
      .then(Number);
  }

  /**
   * @param {object} options see MemoryStore#sync
   * @returns {Promise<{presence: object[], events: object[]}>}
   */
  sync({ page, docs, session, entry, cursor, presenceTtl }) {
    const keys = [this.key('presence', page)].concat(docs.map(doc => this.key('feed', doc)));

    return this.client.collabSync(keys.length, ...keys, session, entry ? JSON.stringify(entry) : '', this.now(), presenceTtl, this.presenceKeyTtl, cursor, this.feedSize)
      .then(([presence, events]) => ({
        presence: presence.map(parseEntry).map(({ n, data }) => Object.assign(data, { lastSeen: n })),
        events: events.map(parseEntry).map(({ n, data }) => Object.assign({ id: n }, data))
      }));
  }

  /**
   * @param {string} page
   * @param {string} session
   * @returns {Promise}
   */
  leave(page, session) {
    return this.client.hdel(this.key('presence', page), session);
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
