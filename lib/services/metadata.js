'use strict';

const _ = require('lodash'),
  db = require('./db'),
  { getSiteFromPrefix } = require('./sites');

function userOrRobot(user) {
  if (user && _.get(user, 'username') && _.get(user, 'provider')) {
    return user;
  } else {
    // no actual user, this was an api key
    return {
      username: 'robot',
      provider: 'clay',
      imageUrl: 'clay-avatar', // kiln will supply a clay avatar
      name: 'Clay',
      auth: 'admin'
    };
  }
}

function publishPage(uri, { url }, user) {
  const NOW = new Date(),
    updatedMeta = {
      published: true,
      publishTime: NOW,
      url,
      history: [{ action: 'publish', timestamp: NOW, users: [userOrRobot(user)] }]
    };

  return putMeta(ref, updatedMeta);
}

function createPage(ref, user) {
  const NOW = new Date(),
    users = [userOrRobot(user)],
    meta = {
      createdAt: NOW,
      archived: false,
      published: false,
      scheduled: false,
      scheduledTime: null,
      publishTime: null,
      updateTime: null,
      firstPublishTime: null,
      url: '',
      title: '',
      authors: [],
      users,
      history: [{action: 'create', timestamp: NOW, users }],
      slug: getSiteFromPrefix(ref.substring(0, ref.indexOf('/_pages'))).slug
    };

  return putMeta(ref, meta);
}

function unpublishPage(uri, user) {
  const updatedMeta = {
    published: false,
    publishTime: null,
    url: '',
    history: [{ action: 'unpublish', timestamp: new Date(), users: [userOrRobot(user)] }]
  };

  return putMeta(uri, updatedMeta);
}

/**
 * Merge some very specific properties of new and
 * old meta data. This is important to preserve
 * published time and history
 *
 * @param {Object} old
 * @param {Object} updated
 * @returns {Object}
 */
function mergeNewAndOldMeta(old, updated) {
  const merged = {
    firstPublishTime: old.firstPublishTime || updated.publishTime
  };

  if (!Object.keys(old).length) {
    return updated;
  }

  if (old.history && updated.history) {
    merged.history = old.history.concat(updated.history);
  }

  return Object.assign(old, updated, merged);
}

/**
 * Write the page's meta object to the DB
 *
 * @param {String} uri
 * @param {Object} newData
 * @returns {Promise}
 */
function putMeta(uri, newData) {
  const id = uri.replace('/meta', '');

  return getMeta(id).then(existing => db.putMeta(id, mergeNewAndOldMeta(existing, newData)));
}

/**
 * Retrieve the page's meta object
 *
 * @param {String} uri
 * @returns {Promise}
 */
function getMeta(uri) {
  const id = uri.replace('/meta', '');

  return db.getMeta(id)
    .catch(() => ({}));
}

module.exports.getMeta = getMeta;
module.exports.putMeta = putMeta;
module.exports.createPage = createPage;
module.exports.publishPage = publishPage;
module.exports.unpublishPage = unpublishPage;
module.exports.userOrRobot = userOrRobot;
