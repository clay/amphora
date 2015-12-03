'use strict';

var interval,
  intervalDelay = 6000; // one minute
const _ = require('lodash'),
  bluebird = require('bluebird'),
  db = require('../services/db'),
  log = require('../log'),
  publishProperty = 'publish',
  references = require('../services/references'),
  rest = require('../rest'),
  siteService = require('../services/sites'),
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
  const latest = references.replaceVersion(url),
    published = references.replaceVersion(url, 'published');

  return rest.getObject(latest).then(function (data) {
    return rest.putObject(published, data).then(function () {
      log.info('published', latest);
    });
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
      log.error('Cannot parse JSON of ' + item.value);
    }
  }));

  return _.select(list, function (item) {
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
  console.log('deleting', uri);
  return db.get(uri).then(JSON.parse).then(function (data) {
    const targetReference = references.replaceVersion(data[publishProperty], scheduledVersion),
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
    targetReference = references.replaceVersion(data[publishProperty], scheduledVersion),
    referencedData = _.assign({_ref: reference}, data),
    ops = [
      { type: 'put', key: reference, value: JSON.stringify(data) },
      { type: 'put', key: targetReference, value: JSON.stringify(referencedData) }
    ];

  return db.batch(ops).return(referencedData);
}

/**
 * @param {[{at: number, publish: string}]} list
 * @returns {Promise}
 */
function publishByTime(list) {
  // list is assumed to be in order of when they should run
  const promises = _.reduce(getPublishableItems(list, new Date().getTime()), function (promises, item) {
    const url = item.value[publishProperty];

    promises.push(publishExternally(url)
      .then(function () { return del(item.key); })
      .catch(function (error) { log.error('publishing error', error); }));

    return promises;
  }, []);

  return bluebird.all(promises);
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
          .then(publishByTime)
          .catch(function (error) {
            log.error('failed to publish by time', error);
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