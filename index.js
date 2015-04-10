// this will set up things
'use strict';

var app = require('express')(),
  routes = require('./services/routes');

module.exports = function () {
  return routes(app);
};