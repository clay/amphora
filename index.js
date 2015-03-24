// this will set up things
'use strict';

var express = require('express'),
  routes = require('./services/routes'),
  composer = require('./services/composer'),
  app = express();

module.exports = function () {
  //add routes
  routes(app);

  // point the renderer towards the layouts folder
  app.set('views', 'layouts/');

  // pass all route handlers into the composer
  app.use(composer);

  return app;
};