'use strict';

var _ = require('lodash'),
  components = require('./services/components');

function flatMap(list, fn) {
  return _.flattenDeep(_.map(list, fn));
}

/**
 * @param {Array} list
 * @param {string} name
 */
function wrapComments(list, name) {
  if (list.length) {
    list.unshift('\n<!-- ' + name + ' Begin -->');
    list.push('<!-- ' + name + ' End -->\n');
  }
}

/**
 * @param {string} component
 * @param {string} slug
 * @param {string} path
 */
function getComponentStyles(component, slug, path) {
  return _.map(components.getStyles(component, slug), function (mediaPath) {
    return '<link rel="stylesheet" type="text/css" href="' + path + mediaPath + '" />';
  });
}

/**
 * @param {string} component
 * @param {string} slug
 */
function getComponentScripts(component, slug, path) {
  return _.map(components.getScripts(component, slug), function (mediaPath) {
    return '<script type="text/javascript" src="' + path + mediaPath + '"></script>';
  });
}

/**
 * @param {string} str
 * @returns {number}
 */
function findBottom(str) {
  var index = str.lastIndexOf('</body>');
  if (index === -1) {
    index = str.lastIndexOf('</');
  }
  return index;
}

/**
 * @param {string} str
 * @returns {number}
 */
function findTop(str) {
  var index = str.indexOf('</head>');
  if (index === -1) {
    index = str.indexOf('>') + 1;
  }
  return index;
}

/**
 * Put items at index in the very large target string.
 *
 * @param {string} str
 * @param {number} index
 * @param {[string]} items
 * @returns {string}
 */
function splice(str, index, items) {
  return str.substr(0, index) + _.flattenDeep(items).join('\n') + str.substr(index);
}

/**
 * Append at the bottom of the head tag, or if no head tag, then the top of root tag.
 *
 * @param {object} data
 * @returns {function}
 */
function appendTop(data) {
  var components = data.components,
    slug = data.site && data.site.slug,
    path = data.site && data.site.path;

  return function (html) {
    var index = findTop(html),
      items = flatMap(components, function (component) {
        return getComponentStyles(component, slug, path);
      });

    wrapComments(items, 'Stylesheets');

    return splice(html, index, items);
  };
}

/**
 * Append at the bottom of the body tag, or if no body tag, then the bottom of the root tag.
 * @param {object} data
 * @returns {function}
 */
function appendBottom(data) {
  var components = data.components,
    slug = data.site && data.site.slug,
    path = data.site && data.site.path;

  return function (html) {
    var index = findBottom(html),
      items = flatMap(components, function (component) {
        return getComponentScripts(component, slug, path);
      });

    wrapComments(items, 'Scripts');

    return splice(html, index, items);
  };
}

module.exports.appendTop = appendTop;
module.exports.appendBottom = appendBottom;
