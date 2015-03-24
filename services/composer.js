'use strict';
var glob = require('glob'),
  _ = require('lodash'),
  path = require('path'),
  log = require('./log'),
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
    },
    filePath, templates, ext;

  if (site && layout) {
    filePath = layoutsFolder + layout + '/' + templateName;
    templates = glob.sync(filePath + '.*');
    console.log(templates)
    // prefer nunjucks template if it exists
    if (templates.length && _.map(templates, function (tpl) { return _.contains(tpl, '.nunjucks'); })) {
      ext = '.nunjucks';
    } else if (templates.length) {
      // otherwise just use the first template you find
      ext = path.extname(templates[0]);
    } else {
      res.status(500).send('No template found for ' + layout);
    }

    console.log(filePath + ext)

    res.render(filePath + ext, data, function (err, html) {
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