'use strict';

const _ = require('lodash'),
  log = require('../log'),
  restler = require('restler'),
  defaultWebhook = {method: 'POST', headers: {'Content-type': 'application/json'}};

/**
 * @param {string} event
 * @param {string} url
 * @param {object} data
 */
function callWebhook(event, url, data) {
  const body = JSON.stringify(_.assign({event: event}, data)),
    options = _.defaults({body: body}, defaultWebhook);

  restler.request(url, options).on('complete', function (result, response) {
    log.info('called webhook', _.pick(response, ['status', 'statusText']), result);
  });
}

/**
 * @param {object} webhook
 * @returns {function}
 */
function getNotifyWebhookCallback(webhook) {
  const regex = new RegExp(webhook.match);

  return function (op) {
    if (op.type === webhook.op && regex.test(op.key)) {
      callWebhook(webhook.event, webhook.url, op);
    }
  };
}

/**
 * @param {object} notify
 * @returns {function}
 */
function define(notify) {
  var notifyFns = [];

  if (!_.isObject(notify)) {
    return _.noop;
  } else {
    notifyFns = notifyFns.concat(_.map(notify.webhooks, getNotifyWebhookCallback));

    return function (op) {
      _.each(notifyFns, function (fn) {
        fn(op);
      });
    };
  }
}

module.exports.define = define;