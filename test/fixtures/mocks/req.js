'use strict';

const _ = require('lodash'),
  control = require('../../../lib/control');

/**
 *
 * @param {object} query
 * @returns {string}
 */
function queryToString(query) {
  return _.map(query, function (value, key) {
    return key + '=' + value;
  }).join('&');
}

module.exports = function () {
  let hostname, path, baseUrl, query,
    params = {},
    headers = {},
    req = {};

  Object.defineProperty(req, 'url', control.defineReadOnly({
    get() {
      let result = path;

      if (query && _.size(query) > 0) {
        result += '?' + queryToString(query);
      }

      return result;
    }
  }));

  Object.defineProperty(req, 'uri', control.defineReadOnly({
    get() { return hostname + baseUrl + path; }
  }));

  Object.defineProperty(req, 'vhost', control.defineReadOnly({
    get() { return { hostname }; }
  }));

  Object.defineProperty(req, 'originalUrl', control.defineReadOnly({
    get() {
      let result = baseUrl + path;

      if (query && _.size(query) > 0) {
        result += '?' + queryToString(query);
      }

      return result;
    }
  }));

  Object.defineProperty(req, 'query', control.defineWritable({
    get() { return query; },
    set(value) { query = value; }
  }));

  Object.defineProperty(req, 'path', control.defineWritable({
    get() { return path; },
    set(value) { path = value; }
  }));

  Object.defineProperty(req, 'baseUrl', control.defineWritable({
    get() { return baseUrl; },
    set(value) { baseUrl = value; }
  }));

  Object.defineProperty(req, 'hostname', control.defineWritable({
    get() { return hostname; },
    set(value) { hostname = value; }
  }));

  Object.defineProperty(req, 'params', control.defineWritable({
    get() { return params; },
    set(value) { params = value; }
  }));

  Object.defineProperty(req, 'headers', control.defineWritable({
    get() { return headers; },
    set(value) { headers = value; }
  }));

  // defaults
  req.path = '/someUrl';
  req.baseUrl = '';
  req.hostname = 'example.com';
  req.query = {};
  req.accepts = _.noop;
  req.get = _.noop;

  return req;
};
