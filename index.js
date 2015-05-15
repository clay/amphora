// this will set up things
'use strict';

var app = require('express')(),
  routes = require('./services/routes');

module.exports = function () {
  return routes(app);
};

module.exports.db = require('./lib/services/db');
module.exports.components = require('./lib/services/components');