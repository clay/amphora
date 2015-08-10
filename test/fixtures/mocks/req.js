'use strict';

var _ = require('lodash');

function defineReadOnly(definition) {
  if (!definition.get) {
    definition.writable = false;
  }
  definition.enumerable = false;
  definition.configurable = false;
  delete definition.set;
  return definition;
}

function defineWritable(definition) {
  if (!definition.set && !definition.get) {
    definition.writable = true;
  }
  definition.enumerable = false;
  definition.configurable = false;
  return definition;
}

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
    req = {};

  Object.defineProperty(req, 'url', defineReadOnly({
    get: function () {
      var result = path;

      if (query && _.size(query) > 0) {
        result += '?' + queryToString(query);
      }

      return result;
    }
  }));

  Object.defineProperty(req, 'uri', defineReadOnly({
    get: function () { return hostname + baseUrl + path; }
  }));

  Object.defineProperty(req, 'vhost', defineReadOnly({
    get: function () { return {hostname: hostname}; }
  }));

  Object.defineProperty(req, 'originalUrl', defineReadOnly({
    get: function () {
      var result = baseUrl + path;

      if (query && _.size(query) > 0) {
        result += '?' + queryToString(query);
      }

      return result;
    }
  }));

  Object.defineProperty(req, 'query', defineWritable({
    get: function () { return query; },
    set: function (value) { query = value; }
  }));

  Object.defineProperty(req, 'path', defineWritable({
    get: function () { return path; },
    set: function (value) { path = value; }
  }));

  Object.defineProperty(req, 'baseUrl', defineWritable({
    get: function () { return baseUrl; },
    set: function (value) { baseUrl = value; }
  }));

  Object.defineProperty(req, 'hostname', defineWritable({
    get: function () { return hostname; },
    set: function (value) { hostname = value; }
  }));

  // defaults
  req.path = '/someUrl';
  req.baseUrl = '';
  req.hostname = 'example.com';
  req.query = {};

  return req;
};
