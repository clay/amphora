// this will set up things
'use strict';

var express = require('express'),
  jade = require('jade'),
  nunjucks = require('byline-nunjucks'),
  mustache = require('mustache-express'),
  routes = require('./services/routes'),
  composer = require('./services/composer'),
  app = express();

module.exports = function () {
  // instantiate nunjucks env
  var env = nunjucks(app);

  // add layout engines
  app.engine('jade', jade.__express);
  app.engine('nunjucks', env.render);
  app.engine('mustache', mustache());

  //add routes
  routes(app);

  // pass all route handlers into the composer
  app.use(composer);

  return app;
};