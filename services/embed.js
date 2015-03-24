'use strict';
var glob = require('glob'),
  path = require('path'),
  _ = require('lodash'),
  engines = require('./engines');

/**
 * get full filename w/ extension
 * @param  {string} filePath e.g. "layouts/index/template"
 * @return {string}          e.g. "layouts/index/template.jade"
 */
function getTemplate(filePath) {
  var possibleTemplates = glob.sync(filePath + '.*'),
    i = 0, l = possibleTemplates.length;

  if (!l) {
    throw new Error('No template files found for ' + filePath);
  }

  for (; i < l; i++) {
    let possTemplate = possibleTemplates[i];

    if (_.contains(possTemplate, 'nunjucks')) {
      return possTemplate + '.nunjucks';
    } else if (_.contains(possTemplate, '.jade')) {
      return possTemplate + '.jade';
    } else if (_.contains(possTemplate, '.mustache')) {
      return possTemplate + '.mustache';
    }
  }
}

/**
 * render a layout or component with some data
 * @param  {string} name 
 * @param  {{}} data 
 * @param  {string} [type] "layout"/"component" defaults to "component"
 * @return {string}      html
 */
function render(name, data, type) {
  type = type || 'component';

  var templateFile = getTemplate(type + 's/' + name + '/template'),
    engine = path.extname(templateFile).substring(1); // get rid of the .

  return engines[engine].render(templateFile, data);
}

exports.render = render;