'use strict';
var config = require('config'),
  glob = require('glob'),
  _ = require('lodash'),
  log = require('./log'),
  siteService = require('./sites'),
  nunjucks = require('nunjucks-filters'),
  multiplex = require('multiplex-templates')({nunjucks: nunjucks()}),
  db = require('./db');

/**
 * get full filename w/ extension
 * @param  {string} name e.g. "entrytext"
 * @return {string}          e.g. "components/entrytext/template.jade"
 */
function getTemplate(name) {
  var filePath = 'components/' + name + '/' + config.get('names.template'),
    possibleTemplates = glob.sync(filePath + '.*');

  if (!possibleTemplates.length) {
    throw new Error('No template files found for ' + filePath);
  }

  // return the first template found
  return possibleTemplates[0];
}

module.exports = function (req, res) {
  var site = siteService.sites()[res.locals.site],
    layout = res.locals.layout, // todo: get layout object
    locals = res.locals,
    data = {
      site: site,
      layout: layout,
      locals: locals,
      getTemplate: getTemplate
    };

  if (site && layout) {
    try {
      res.send(multiplex.render(layout, data, 'layout'));
    } catch (e) {
      log.error(e.message, e.stack);
      res.status(500).send('ERROR: Cannot render template!');
    }
  } else {
    // log.error('404 not found: ', req.hostname + req.originalUrl);
    res.status(404).send('404 Not Found');
  }
};

module.exports.getTemplate = getTemplate; // for testing