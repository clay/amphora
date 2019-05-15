'use strict';

const _ = require('lodash'),
  bus = require('./bus'),
  { replaceVersion } = require('clayutils'),
  sitesService = require('./sites');
var db = require('./db');

/**
 * Either return the user object or
 * the system for a specific action
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
 * On publish of a page, update the
 * metadara for the page
 *
 * @param {String} uri
 * @param {Object} publishMeta
 * @param {Object|Undefined} user
 * @returns {Promise}
 */
function publishPage(uri, publishMeta, user) {
  const NOW = new Date().toISOString(),
    update = {
      published: true,
      publishTime: NOW,
      history: [{ action: 'publish', timestamp: NOW, users: [userOrRobot(user)] }]
    };

  return changeMetaState(uri, Object.assign(publishMeta, update));
}

/**
 * Create the initial meta object
 * for the page
 *
 * @param {String} ref
 * @param {Object|Underfined} user
 * @returns {Promise}
 */
function createPage(ref, user) {
  const NOW = new Date().toISOString(),
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
      siteSlug: sitesService.getSiteFromPrefix(ref.substring(0, ref.indexOf('/_pages'))).slug
    };

  return putMeta(ref, meta);
}

function createLayout(ref, user) {
  const NOW = new Date().toISOString(),
    users = [userOrRobot(user)],
    meta = {
      createdAt: NOW,
      published: false,
      publishTime: null,
      updateTime: null,
      firstPublishTime: null,
      title: '',
      history: [{ action: 'create', timestamp: NOW, users }],
      siteSlug: sitesService.getSiteFromPrefix(ref.substring(0, ref.indexOf('/_layouts'))).slug
    };

  return putMeta(ref, meta);
}

/**
 * Update the layouts meta object
 * on publish
 *
 * @param {String} uri
 * @param {Object} user
 * @returns {Promise}
 */
function publishLayout(uri, user) {
  const NOW = new Date().toISOString(),
    users = [userOrRobot(user)],
    update = {
      published: true,
      publishTime: NOW,
      history: [{ action: 'publish', timestamp: NOW, users }]
    };

  return changeMetaState(uri, update);
}

/**
 * Update the page meta on unpublish
 *
 * @param {String} uri
 * @param {Object} user
 * @returns {Promise}
 */
function unpublishPage(uri, user) {
  const update = {
    published: false,
    publishTime: null,
    url: '',
    history: [{ action: 'unpublish', timestamp: new Date().toISOString(), users: [userOrRobot(user)] }]
  };

  return changeMetaState(uri, update);
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
    bus.publish('saveMeta', { uri, data });
    return data;
  };
}

/**
 * Given a uri and an object that is an
 * update, retreive the old meta, merge
 * the new and old and then put the merge
 * to the db.
 *
 * @param {String} uri
 * @param {Object} update
 * @returns {Promise}
 */
function changeMetaState(uri, update) {
  return getMeta(uri)
    .then(old => mergeNewAndOldMeta(old, update))
    .then(updatedMeta => putMeta(uri, updatedMeta));
}

/**
 * Given the existing meta object and an update,
 * merge the properties which should never be
 * overriden:
 *
 * - firstPublishTime
 * - history
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
 * @param {Object} locals
 * @returns {Promise}
 */
function patchMeta(uri = '', data = {}, locals = {}) {
  const id = replaceVersion(uri.replace('/meta', ''));

  if (data.shouldPatchArchive) addArchiveEvent(data, locals.user);

  return db.patchMeta(id, data)
    .then(() => getMeta(uri))
    .then(pubToBus(id));
}

/**
 * Adds the archive events to the metadata history.
 * @param {Object} data
 * @param {Object} user
 * @returns {void}
 */
function addArchiveEvent(data, user = {}) {
  const action = data.archived ? 'archive' : 'unarchive',
    historyEntry = { action, timestamp: new Date().toISOString(), users: [userOrRobot(user)] };

  data.history.push(historyEntry);
  delete data.shouldPatchArchive;
}

/**
 * Check metadata property or properties for truthy values.
 * Returns true if all properties have truthy values.
 * @param {String} uri
 * @param {String | Array} props
 * @returns {Boolean | Object}
 */
function checkProps(uri, props) {
  const id = replaceVersion(uri.replace('/meta', ''));

  return db.getMeta(id)
    .then(meta => {
      return Array.isArray(props)
        ? props.every(prop => meta[prop])
        : meta[props] && true;
    })
    .catch(err => {
      throw new Error(err);
    });
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
module.exports.checkProps = checkProps;

// For testing
module.exports.setDb = mock => db = mock;
