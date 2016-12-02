'use strict';

const nodeFetch = require('node-fetch'),
  jsonHeaders = {'Content-type':'application/json', Authorization: `Token ${process.env.CLAY_ACCESS_KEY}` };

function getObject(url, options) {
  return exports.fetch(url, options).then(function (response) {
    return response.json();
  });
}

function putObject(url, data) {
  return exports.fetch(url, {method: 'PUT', body: JSON.stringify(data), headers: jsonHeaders});
}

module.exports.fetch = nodeFetch;
module.exports.getObject = getObject;
module.exports.putObject = putObject;
