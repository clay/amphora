'use strict';

var _ = require('lodash'),
  control = require('../../../lib/control');

/**
 *
 * @param query
 * @returns {string}
 */
function queryToString(query) {
  return _.map(query, function (value, key) {
    return key + '=' + value;
  }).join('&');
}

module.exports = function () {
  var hostname, path, baseUrl, query,
    params = {},
    headers = {},
    req = {};

  Object.defineProperty(req, 'url', control.defineReadOnly({
    get: function () {
      var result = path;

      if (query && _.size(query) > 0) {
        result += '?' + queryToString(query);
      }

      return result;
    }
  }));

  Object.defineProperty(req, 'uri', control.defineReadOnly({
    get: function () { return hostname + baseUrl + path; }
  }));

  Object.defineProperty(req, 'vhost', control.defineReadOnly({
    get: function () { return {hostname: hostname}; }
  }));

  Object.defineProperty(req, 'originalUrl', control.defineReadOnly({
    get: function () {
      var result = baseUrl + path;

      if (query && _.size(query) > 0) {
        result += '?' + queryToString(query);
      }

      return result;
    }
  }));

  Object.defineProperty(req, 'query', control.defineWritable({
    get: function () { return query; },
    set: function (value) { query = value; }
  }));

  Object.defineProperty(req, 'path', control.defineWritable({
    get: function () { return path; },
    set: function (value) { path = value; }
  }));

  Object.defineProperty(req, 'baseUrl', control.defineWritable({
    get: function () { return baseUrl; },
    set: function (value) { baseUrl = value; }
  }));

  Object.defineProperty(req, 'hostname', control.defineWritable({
    get: function () { return hostname; },
    set: function (value) { hostname = value; }
  }));

  Object.defineProperty(req, 'params', control.defineWritable({
    get: function () { return params; },
    set: function (value) { params = value; }
  }));

  Object.defineProperty(req, 'headers', control.defineWritable({
    get: function () { return headers; },
    set: function (value) { headers = value; }
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
