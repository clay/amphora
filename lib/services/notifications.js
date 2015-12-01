'use strict';

const _ = require('lodash'),
  log = require('../log'),
  restler = require('restler'),
  defaultWebhook = {method: 'POST', headers: {'Content-type': 'application/json'}};

/**
 * @param {string} url
 * @param {object} [options]
 * @param {string} [options.method]
 * @param {*} [options.body]
 * @param {object} [options.headers]
 */
function callWebhook(url, options) {
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
    if (op.type === webhook.op && op.key.test(regex)) {
      if (_.isPlainObject(op.value)) {
        let opClone = _.omit(op, 'value');
        opClone.value = JSON.stringify(op.value);
        op = opClone;
      }

      callWebhook(webhook.url, _.defaults({ body: {
        event: webhook.event,
        key: op.key,
        value: op.value
      } }, defaultWebhook));
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