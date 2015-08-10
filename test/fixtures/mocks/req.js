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

module.exports = function () {
  var host, url, path, baseUrl, query,
    req = {};
  req.baseUrl = '';
  req.host = 'example.com';
  req.vhost = {hostname: 'example.com'};
  req.query = {};

  Object.defineProperty(req, 'uri', defineReadOnly({
    get: function () { return host + baseUrl + url; }
  }));

  Object.defineProperty(req, 'vhost', defineReadOnly({
    get: function () { return {hostname: host}; }
  }));

  Object.defineProperty(req, 'originalUrl', defineReadOnly({
    get: function () {
      var path = baseUrl + url;

      if (query && _.size(query) > 0) {
        path += '?' + _.map(query, function (value, key) {
          return key + '=' + value;
        }).join('&');
      }

      return path;
    }
  }));

  Object.defineProperty(req, 'query', defineWritable({
    get: function () { return query; },
    set: function (value) { query = value; }
  }));

  Object.defineProperty(req, 'url', defineWritable({
    get: function () { return url; },
    set: function (value) { url = value; }
  }));

  Object.defineProperty(req, 'path', defineWritable({
    get: function () { return path; },
    set: function (value) { path = value; }
  }));

  Object.defineProperty(req, 'baseUrl', defineWritable({
    get: function () { return baseUrl; },
    set: function (value) { baseUrl = value; }
  }));

  Object.defineProperty(req, 'host', defineWritable({
    get: function () { return host; },
    set: function (value) { host = value; }
  }));

  // defaults
  req.url = '/someUrl';
  req.path = '/someUrl';
  req.baseUrl = '';
  req.host = 'example.com';
  req.query = {};

  return req;
};
