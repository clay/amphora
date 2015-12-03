'use strict';

const _ = require('lodash'),
  bluebird = require('bluebird'),
  contentType = 'Content-type',
  log = require('../log'),
  rest = require('../rest');

/**
 * @param {string} event
 * @param {string} url
 * @param {object} data
 * @returns {Promise}
 */
function callWebhook(event, url, data) {
  const headers = {
      'X-Event': event
    },
    options = {
      method: 'POST',
      headers: headers
    };

  if (_.isPlainObject(data)) {
    headers[contentType] = 'application/json';
    options.body = JSON.stringify(data);
  } else if (_.isString(data)) {
    headers[contentType] = 'text/plain';
    options.body = data;
  }

  return rest.fetch(url, options).then(function (response) {
    log.info('called webhook', _.pick(response, ['status', 'statusText']));
  });
}

/**
 * @param {object} site
 * @param {string} eventName
 * @param {*} [data]
 * @returns {Promise}
 */
function notify(site, eventName, data) {
  const events = _.get(site, 'notify.webhooks');

  if (events && _.isArray(events[eventName])) {
    return bluebird.all(_.map(events[eventName], function (url) { return callWebhook(eventName, url, data); }));
  } else {
    return bluebird.resolve();
  }
}

module.exports.notify = notify;