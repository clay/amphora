'use strict';

const _ = require('lodash'),
  bluebird = require('bluebird'),
  contentType = 'Content-type',
  rest = require('../rest');
var log = require('./logger').setup({
  file: __filename
});

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
      headers
    };

  if (_.isPlainObject(data)) {
    headers[contentType] = 'application/json';
    options.body = JSON.stringify(data);
  } else if (_.isString(data)) {
    headers[contentType] = 'text/plain';
    options.body = data;
  }

  return rest.fetch(url, options)
    .then(function (resp) {
      var { status, statusText } = resp;

      if (status < 400) {
        log('info', `successfully called webhook ${url}`, { status, statusText });
      } else {
        log('error', `error calling webhook ${url}`);
      }

      // Node Fetch does not close a connection unless
      // you call `.json()`, `.text()` or `.buffer()`
      return resp.json();
    })
    .catch(function (err) {
      log('error', err.message);
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
    return bluebird.all(_.map(events[eventName], url => callWebhook(eventName, url, data) ));
  }

  return bluebird.resolve();
}

module.exports.notify = notify;
// For testing
module.exports.setLog = fakeLogger => { log = fakeLogger; };
