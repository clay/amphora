'use strict';

var interval,
  intervalDelay = 60000; // one minute
const _ = require('lodash'),
  bluebird = require('bluebird'),
  components = require('../services/components'),
  db = require('../services/db'),
  references = require('../services/references'),
  siteService = require('../services/sites'),
  scheduledAtProperty = 'at',
  publishProperty = 'publish',
  scheduledVersion = 'scheduled',
  pages = require('../services/pages'),
  log = require('../log');

/**
 * @param {number} value
 */
function setScheduleInterval(value) {
  intervalDelay = value;
}

/**
 * @param {string} uri
 * @returns {Promise}
 */
function publishPage(uri) {
  return pages.publish(uri);
}

/**
 * @param {string} uri
 * @returns {Promise}
 */
function publishComponent(uri) {
  return components.get(references.replaceVersion(uri)).then(function (data) {
    return components.put(references.replaceVersion(uri, 'published'), data);
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
 * @param {string} uri
 * @returns {Promise}
 */
function publishItem(uri) {
  var promise;

  if (uri) {
    if (uri.indexOf('/pages/') > -1) {
      promise = publishPage(uri);
    } else if (uri.indexOf('/components/') > -1) {
      promise = publishComponent(uri);
    } else {
      log.error('Unknown publish type: ' + uri);
    }
  } else {
    log.error('Missing publish type');
  }

  if (promise) {
    promise.then(function () {
      log.info('published', uri);
    }).catch(function (err) {
      log.error('error publishing', uri, err.stack);
    });
  } else {
    promise = bluebird.resolve();
  }

  return promise;
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
  } else if (!_.isString(publish)) {
    throw new Error('Client: Missing "publish" property as string.');
  }

  return prefix + '/schedule/' + at.toString(36) + '-' +
    publish.replace(/[\/\.]/g, '-').replace(/-(?=-)/g, '');
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
    const reference = createScheduleObjectUID(uri, data),
      targetReference = references.replaceVersion(data[publishProperty], scheduledVersion),
      ops = [
        { type: 'del', key: reference },
        { type: 'del', key: targetReference }
      ];

    return db.batch(ops)
      .return(data);
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

  return db.batch(ops)
    .return(referencedData);
}

/**
 * @param {[{at: number, publish: string}]} list
 * @returns {Promise}
 */
function publishByTime(list) {
  // list is assumed to be in order of when they should run
  const promises = _.reduce(getPublishableItems(list, new Date().getTime()), function (promises, item) {
    const uri = item.value[publishProperty];

    promises.push(publishItem(uri).then(function () { return del(item.key); }));

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
      return _.map(siteService.sites(), function (site) {
        return db.pipeToPromise(db.list({
          prefix: site.host + site.path + '/schedule',
          keys: true,
          values: true,
          isArray: true
        })).then(JSON.parse)
          .then(publishByTime);
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