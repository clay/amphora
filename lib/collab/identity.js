'use strict';

// Distinct colors for editor outlines, name tags and avatars, each at least
// 4.5:1 against white text (WCAG AA for the small labels). Assigned by user, so
// a person keeps their color across tabs and pages.
const crypto = require('crypto'),
  COLORS = ['#c2185b', '#7b1fa2', '#3949ab', '#0d47a1', '#00695c', '#2e7d32', '#bf360c', '#6d4c41', '#ad1457', '#5e35b1'];

/**
 * Opaque, stable id for a user: a keyed hash of their uid (username@provider).
 * Presence is shared with every editor on a page and usernames are often email
 * addresses, so the id must not be reversible by hashing a list of addresses;
 * the key is a secret shared by every instance (see the store's `salt`).
 * @param {object} user amphora-auth user
 * @param {string} secret
 * @returns {string}
 */
function userId(user, secret) {
  const uid = `${String(user.username || '').toLowerCase()}@${user.provider || ''}`;

  return crypto.createHmac('sha256', secret).update(uid).digest('hex').slice(0, 16);
}

/**
 * What other editors get to see about a user.
 * @param {object} user amphora-auth user
 * @param {string} secret
 * @returns {{id: string, name: string, imageUrl: string, color: string}}
 */
function publicIdentity(user, secret) {
  const id = userId(user, secret);

  return {
    id,
    name: user.name || String(user.username || 'Someone').split('@')[0],
    imageUrl: user.imageUrl || '',
    color: COLORS[parseInt(id.slice(0, 8), 16) % COLORS.length]
  };
}

/**
 * Opaque id for one editor tab, safe to show other editors (it can't be used
 * to act as that tab).
 * @param {string} key presence key (user id + session)
 * @param {string} secret
 * @returns {string}
 */
function tabId(key, secret) {
  return crypto.createHmac('sha256', secret).update(`tab:${key}`).digest('hex').slice(0, 16);
}

module.exports.publicIdentity = publicIdentity;
module.exports.userId = userId;
module.exports.tabId = tabId;
module.exports.COLORS = COLORS;
