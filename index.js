// this will set up things
'use strict';

var app = require('express')(),
  routes = require('./lib/routes');

module.exports = function () {
  return routes(app);
};

//services to outside
module.exports.db = require('./lib/services/db');
module.exports.components = require('./lib/services/components');