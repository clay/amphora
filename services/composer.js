'use strict';
var config = require('config'),
  glob = require('glob'),
  log = require('./log'),
  siteService = require('./sites'),
  nunjucks = require('nunjucks-filters'),
  multiplex = require('multiplex-templates')({nunjucks: nunjucks()}),
  db = require('./db'),
  schema = require('./schema'),
  winston = require('winston'),
  _ = require('lodash'),
  chalk = require('chalk');

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
  var baseTemplate, data,
    site = siteService.sites()[res.locals.site],
    layout = res.locals.layout, // todo: get layout object
    locals = res.locals,
    state = {
      site: site,
      layout: layout,
      locals: locals,
      getTemplate: getTemplate
    };

  db.get('/pages/' + new Buffer(req.vhost.hostname + req.url).toString('base64')).then(function (result) {

    baseTemplate = getTemplate(/components\/(.*?)\//.exec(result)[1]);

    winston.info('rendering ' + baseTemplate);

    return db.get(result)
  }).then(JSON.parse).then(function (result) {
    return schema.resolveDataReferences(result);
  }).then(function (result) {

    winston.info(chalk.dim('serving ' + require('util').inspect(result, true, 5)));

    //ata = result;

    data = _.assign(state, result);
    data.state = state;
    return data;
  }).catch(function (err) {
    winston.warn(req.vhost.hostname + req.url + '\n' + chalk.dim(err.stack));
  }).finally(function () {
    if (site && layout) {
      try {
        res.send(multiplex.render(baseTemplate, data));
      } catch (e) {
        log.error(e.message, e.stack);
        res.status(500).send('ERROR: Cannot render template!');
      }
    } else {
      // log.error('404 not found: ', req.hostname + req.originalUrl);
      res.status(404).send('404 Not Found');
    }
  });
};

module.exports.getTemplate = getTemplate; // for testing