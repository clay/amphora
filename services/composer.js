'use strict';
var log = require('./log'),
  siteService = require('./sites'),
  nunjucks = require('byline-nunjucks'),
  embed = require('byline-embed');

// add filters to nunjucks env
nunjucks(embed.engines.nunjucks);

module.exports = function (req, res) {
  var site = siteService.sites()[res.locals.site],
    layout = res.locals.layout, // todo: get layout object
    locals = res.locals,
    data = {
      site: site,
      layout: layout,
      locals: locals
    };

  if (site && layout) {
    try {
      res.send(embed.render(layout, data, 'layout'));
    } catch(e) {
      log.error(e.message, e.stack);
      res.status(500).send('ERROR: Cannot render template!');
    }
  } else {
    // log.error('404 not found: ', req.hostname + req.originalUrl);
    res.status(404).send('404 Not Found');
  }
};