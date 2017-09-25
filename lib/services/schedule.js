'use strict';

let interval,
  intervalDelay = 50000 + Math.floor(Math.random() * 10000); // just under one minute
const _ = require('lodash'),
  bluebird = require('bluebird'),
  db = require('./db'),
  log = require('./log').setup({file: __filename}),
  publishProperty = 'publish',
  references = require('./references'),
  rest = require('../rest'),
  siteService = require('./sites'),
  scheduledAtProperty = 'at',
  scheduledVersion = 'scheduled',
  uid = require('../uid');

/**
 * @param {number} value
 */
function setScheduleInterval(value) {
  intervalDelay = value;
}

/**
 * Note: There is nothing to do if this fails except log
 * @param {string} url
 * @returns {Promise}
 */
function publishExternally(url) {
  return bluebird.try(function () {
    const published = references.replaceVersion(url, 'published');

    return rest.putObject(published);
  });
}

/**
 * Get all the publishable things in the schedule
 * @param {[{key: string, value: string}]} list
 * @param {number} now
 * @returns {[{key: string, value: {at: number, publish: string}}]}
 */
function getPublishableItems(list, now) {
  // attempt to convert JSON to Object
  list = _.compact(_.map(list, function (item) {
    try {
      item.value = item.value && JSON.parse(item.value);
      return item;
    } catch (ex) {
      log('error', 'Cannot parse JSON of', item.value);
    }
  }));

  return _.filter(list, function (item) {
    return item.value && item.value[scheduledAtProperty] < now;
  });
}

/**
 * Create the id for the new item
 *
 * NOTE: Do not rely on how this ID is created.  This might (and should) be changed to something more
 * random (like a cid).
 *
 * @param {string} uri
 * @param {object} data
 * @returns {string}
 * @throws Error if missing "at" or "publish" properties
 */
function createScheduleObjectUID(uri, data) {
  const prefix = uri.substr(0, uri.indexOf('/schedule')),
    at = data[scheduledAtProperty],
    publish = data[publishProperty];

  if (!_.isNumber(at)) {
    throw new Error('Client: Missing "at" property as number.');
  } else if (!references.isUrl(publish)) {
    throw new Error('Client: Missing "publish" property as valid url.');
  }

  return prefix + '/schedule/' + uid.get();
}

/**
 * NOTE:  We _cannot_ delete without knowing the thing that was published because we need to delete
 * the @scheduled location as well.
 *
 * @param {string} uri
 * @returns {Promise}
 */
function del(uri) {
  return db.get(uri).then(JSON.parse).then(function (data) {
    const targetUri = references.urlToUri(data[publishProperty]),
      targetReference = references.replaceVersion(targetUri, scheduledVersion),
      ops = [
        { type: 'del', key: uri },
        { type: 'del', key: targetReference }
      ];

    return db.batch(ops).return(data);
  });
}

/**
 * Create a schedule item to publish something in the future
 * @param {string} uri
 * @param {object} data
 * @returns {Promise}
 */
function post(uri, data) {
  const reference = createScheduleObjectUID(uri, data),
    targetUri = references.urlToUri(data[publishProperty]),
    targetReference = references.replaceVersion(targetUri, scheduledVersion),
    referencedData = _.assign({_ref: reference}, data),
    ops = [
      { type: 'put', key: reference, value: JSON.stringify(data) },
      { type: 'put', key: targetReference, value: JSON.stringify(referencedData) }
    ];

  return db.batch(ops).then(function () {
    log('info', 'scheduled', targetUri, `(${data.at})`);
  }).return(referencedData);
}

/**
 * @param {[Promise]} promises
 * @param {{key: string, value: string}} item
 * @returns {[Promise]}
 */
function publishByTime(promises, item) {
  promises.push(publishExternally(item.value[publishProperty])
    .then(function () { return del(item.key); }));

  return promises;
}

/**
 * @param {[{key: string, value: string}]} list
 * @returns {Promise}
 */
function publishEachByTime(list) {
  // list is assumed to be in order of when they should run
  const now = new Date().getTime();

  return bluebird.all(_.reduce(getPublishableItems(list, now), publishByTime, []));
}

/**
 * Start waiting for things to publish (but only if we're not already listening)
 */
function startListening() {
  if (!interval) {
    interval = setInterval(function () {
      // get list for each site
      _.each(siteService.sites(), function (site) {
        db.pipeToPromise(db.list({
          prefix: site.host + site.path + '/schedule',
          keys: true,
          values: true,
          isArray: true
        })).then(JSON.parse)
          .then(publishEachByTime)
          .catch(function (error) {
            log('error', 'failed to publish', error);
          });
      });
    }, intervalDelay);
  }
}

/**
 * Stop waiting for things to publish
 */
function stopListening() {
  if (interval) {
    clearInterval(interval);
    interval = null;
  }
}

module.exports.post = post;
module.exports.del = del;
module.exports.startListening = startListening;
module.exports.stopListening = stopListening;
module.exports.setScheduleInterval = setScheduleInterval;
