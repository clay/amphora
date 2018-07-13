'use strict';

const _ = require('lodash'),
  db = require('./db'),
  bus = require('./bus'),
  { replaceVersion } = require('clayutils'),
  { getSiteFromPrefix } = require('./sites');

/**
 *
 * @param {Object} user
 * @returns {Object}
 */
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

/**
 *
 * @param {*} uri
 * @param {*} param1
 * @param {*} user
 */
function publishPage(uri, publishMeta, user) {
  const NOW = new Date(),
    updatedMeta = {
      published: true,
      publishTime: NOW,
      history: [{ action: 'publish', timestamp: NOW, users: [userOrRobot(user)] }]
    };

  return putMeta(uri, Object.assign(publishMeta, updatedMeta));
}

/**
 *
 * @param {*} ref
 * @param {*} user
 */
function createPage(ref, user) {
  const NOW = new Date(),
    users = [userOrRobot(user)],
    meta = {
      createdAt: NOW,
      archived: false,
      published: false,
      publishTime: null,
      updateTime: null,
      urlHistory: [],
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

function createLayout(ref, user) {
  const NOW = new Date(),
    users = [userOrRobot(user)],
    meta = {
      createTime: NOW,
      published: false,
      publishTime: null,
      updateTime: null,
      firstPublishTime: null,
      history: [{ action: 'create', timestamp: NOW, users }],
      siteSlug: getSiteFromPrefix(ref.substring(0, ref.indexOf('/_layouts'))).slug
    };

  return putMeta(ref, meta);
}

function publishLayout(ref, user) {
  const NOW = new Date(),
    users = [userOrRobot(user)],
    meta = {
      published: true,
      publishTime: NOW,
      firstPublishTime: NOW,
      history: [{ action: 'publish', timestamp: NOW, users }]
    };

  return putMeta(ref, meta);
}

/**
 *
 * @param {*} uri
 * @param {*} user
 */
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
 * Publish the `saveMeta` topic to
 * the event bus
 *
 * @param {String} uri
 * @returns {Function}
 */
function pubToBus(uri) {
  return (data) => {
    bus.publish('saveMeta', JSON.stringify({ uri, data }));
    return data;
  };
}

/**
 * Retrieve the page's meta object
 *
 * @param {String} uri
 * @returns {Promise}
 */
function getMeta(uri) {
  const id = replaceVersion(uri.replace('/meta', ''));

  return db.getMeta(id)
    .catch(() => ({}));
}

/**
 * Write the page's meta object to the DB
 *
 * @param {String} uri
 * @param {Object} data
 * @returns {Promise}
 */
function putMeta(uri, data) {
  const id = replaceVersion(uri.replace('/meta', ''));

  return db.putMeta(id, data)
    .then(pubToBus(id));
}

/**
 * Update a subset of properties on
 * a metadata object
 *
 * @param {String} uri
 * @param {Object} data
 * @returns {Promise}
 */
function patchMeta(uri, data) {
  const id = replaceVersion(uri.replace('/meta', ''));

  return db.patchMeta(id, data)
    .then(() => getMeta(uri))
    .then(pubToBus(id));
}

module.exports.getMeta = getMeta;
module.exports.putMeta = putMeta;
module.exports.patchMeta = patchMeta;
module.exports.createPage = createPage;
module.exports.createLayout = createLayout;
module.exports.publishPage = publishPage;
module.exports.publishLayout = publishLayout;
// TODO: unpublish layout?
module.exports.unpublishPage = unpublishPage;
module.exports.userOrRobot = userOrRobot;
