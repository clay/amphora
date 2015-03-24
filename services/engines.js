'use strict';
var nunjucks = require('byline-nunjucks')(),
  jade = require('jade').__express,
  mustache = require('mustache-express')();

module.exports = {
  nunjucks: nunjucks,
  jade: jade,
  mustache: mustache
};