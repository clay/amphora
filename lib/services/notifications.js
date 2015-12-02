'use strict';

const _ = require('lodash'),
  log = require('../log'),
  restler = require('restler'),
  contentType = 'Content-type';

/**
 * @param {string} event
 * @param {string} url
 * @param {object} data
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

  restler.request(url, options).on('complete', function (result, response) {
    log.info('called webhook', _.pick(response, ['status', 'statusText']), result);
  });
}

/**
 * @param {object} site
 * @param {string} eventName
 * @param {*} [data]
 * @returns {function}
 */
function notify(site, eventName, data) {
  const events = _.get(site, 'notify.webhooks');

  if (events && _.isArray(events[eventName])) {
    _.each(events[eventName], function (url) {
      callWebhook(eventName, url, data);
    });
  }
}

module.exports.notify = notify;