// this will set up things
'use strict';

var express = require('express'),
  routes = require('./services/routes'),
  composer = require('./services/composer'),
  app = express();

module.exports = function () {
  return routes(app);
};