'use strict';

const jsonHeaders = {'Content-type':'application/json', Authorization: `Token ${process.env.CLAY_ACCESS_KEY}` };

function getObject(url, options) {
  return exports.fetch(url, options).then(function (response) {
    return response.json();
  });
}

function putObject(url, data) {
  return exports.fetch(url, {method: 'PUT', body: JSON.stringify(data), headers: jsonHeaders});
}

// Node's built-in fetch, looked up when called (tests stub exports.fetch)
module.exports.fetch = (url, options) => fetch(url, options);
module.exports.getObject = getObject;
module.exports.putObject = putObject;
