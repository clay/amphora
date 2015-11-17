'use strict';

var interval;
const _ = require('lodash'),
  bluebird = require('bluebird'),
  db = require('../services/db'),
  siteService = require('../services/sites'),
  scheduledAtProperty = 'at',
  publishProperty = 'publish',
  pages = require('../services/pages'),
  log = require('../log'),
  intervalDelay = 60 * 1000; // one minute

/**
 * @param {string} uri
 * @param {number} at
 * @returns {Promise.<T>}
 */
function publishPage(uri, at) {
  return pages.publish(uri)
    .then(function () {
      log.info('published', uri, 'at', at);
    }).catch(function (err) {
      log.error('error publishing', uri, 'at', at, err.stack);
    });
}

/**
 * @param {[{at: number, publish: string}]} list
 * @returns {Promise}
 */
function publishByTime(list) {
  const promises = [],
    now = new Date().getTime();

  // list is assumed to be in order of when they should run
  while (list.length && list[0][scheduledAtProperty] < now) {
    let item = list.shift(),
      at = item[scheduledAtProperty],
      publish = item[publishProperty];

    if (publish.indexOf('/pages/')) {
      promises.push(publishPage(publish, at));
    }
  }

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
        return db.pipeToPromise(db.list({prefix: site.host + site.path + '/schedule'})).then(publishByTime);
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

  return db.put(reference, data).then(function () {
    return _.assign({_ref: reference}, data);
  });
}

module.exports.create = create;
module.exports.startListening = startListening;
module.exports.stopListening = stopListening;