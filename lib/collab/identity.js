'use strict';

// Distinct, WCAG AA-contrast (against white text) colors for editor cursors,
// outlines and avatars. Assigned by user, so a person keeps their color across
// tabs and pages.
const crypto = require('crypto'),
  COLORS = ['#c2185b', '#7b1fa2', '#3949ab', '#0277bd', '#00796b', '#2e7d32', '#ef6c00', '#6d4c41', '#d81b60', '#5e35b1'];

/**
 * Opaque, stable id for a user. Derived from the user's uid (username@provider)
 * without exposing it: presence is shared with every editor on a page, and
 * usernames are often email addresses.
 * @param {object} user amphora-auth user
 * @returns {string}
 */
function userId(user) {
  const uid = `${String(user.username || '').toLowerCase()}@${user.provider || ''}`;

  return crypto.createHash('sha256').update(uid).digest('hex').slice(0, 16);
}

/**
 * What other editors get to see about a user.
 * @param {object} user amphora-auth user
 * @returns {{id: string, name: string, imageUrl: string, color: string}}
 */
function publicIdentity(user) {
  const id = userId(user);

  return {
    id,
    name: user.name || String(user.username || 'Someone').split('@')[0],
    imageUrl: user.imageUrl || '',
    color: COLORS[parseInt(id.slice(0, 8), 16) % COLORS.length]
  };
}

module.exports.publicIdentity = publicIdentity;
module.exports.userId = userId;
module.exports.COLORS = COLORS;
