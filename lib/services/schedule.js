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
  pages = require('../services/pages'),
  log = require('../log');

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
function getPublishable(list, now) {
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
function publish(uri) {
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
 * @param {[{at: number, publish: string}]} list
 * @returns {Promise}
 */
function publishByTime(list) {
  // list is assumed to be in order of when they should run
  const promises = _.reduce(getPublishable(list, new Date().getTime()), function (promises, item) {
    const uri = item.value[publishProperty];

    promises.push(publish(uri).then(function () { return db.del(item.key); }));

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

/**
 * Create a schedule item to publish something in the future
 * @param {string} uri
 * @param {object} data
 * @returns {Promise}
 */
function create(uri, data) {
  var reference;
  const prefix = uri.substr(0, uri.indexOf('/schedule')),
    at = data[scheduledAtProperty],
    publish = data[publishProperty];

  if (!_.isNumber(at)) {
    throw new Error('Client: Missing "at" property as number.');
  } else if (!_.isString(publish)) {
    throw new Error('Client: Missing "publish" property as string.');
  }

  reference = prefix + '/schedule/' + at.toString(36) + '-' +
    publish.replace(/[\/\.]/g, '-').replace(/-(?=-)/g, '');

  return db.put(reference, JSON.stringify(data)).then(function () {
    return _.assign({_ref: reference}, data);
  });
}

module.exports.create = create;
module.exports.startListening = startListening;
module.exports.stopListening = stopListening;
module.exports.setScheduleInterval = setScheduleInterval;