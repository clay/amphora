'use strict';
var log = require('./log'),
  config = require('config'),
  siteService = require('./sites'),
  layoutsFolder = 'layouts/',
  templateName = config.get('names.template') || 'template'; // defaults to template.ext

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
    res.render(layoutsFolder + layout + '/' + templateName, data, function (err, html) {
      if (err) {
        log.error(err.message, err.stack);
        res.status(500).send('Cannot render this page.');
      } else {
        res.send(html);
      }
    });
  } else {
    // log.error('404 not found: ', req.hostname + req.originalUrl);
    res.status(404).send('404 Not Found');
  }
};