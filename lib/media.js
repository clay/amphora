'use strict';

var _ = require('lodash'),
  files = require('./files'),
  path = require('path'),
  mediaDir = path.join(process.cwd(), 'public');

/**
 * @param list
 * @param name
 */
function wrapComments(list, name) {
  if (list.length) {
    list.unshift('\n<!-- ' + name + ' Begin -->');
    list.push('<!-- ' + name + ' End -->\n');
  }
}

/**
 * @param component
 * @param slug
 */
function getComponentStyles(component, slug) {
  return _.map(_.filter([
    path.join(mediaDir, 'css', component + '.css'),
    path.join(mediaDir, 'css', component + '.' + slug + '.css')
  ], files.safeFileExists), function (filePath) {
    var mediaPath = filePath.substr(mediaDir.length);

    return '<link rel="stylesheet" type="text/css" href="' + mediaPath + '" />';
  });
}

/**
 * @param component
 * @param slug
 */
function getComponentScripts(component, slug) {
  return _.map(_.filter([
    path.join(mediaDir, 'js', component + '.js'),
    path.join(mediaDir, 'js', component + '.' + slug + '.js')
  ], files.safeFileExists), function (filePath) {
    var mediaPath = filePath.substr(mediaDir.length);

    return '<script type="text/javascript" src="' + mediaPath + '"></script>';
  });
}

/**
 * @param {[string]} str
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
 * @param {[string]} str
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
 * @param {[string]} str
 * @param {number} index
 * @param {[string]} items
 * @returns {[string]}
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
  var components = data.components;
  return function (html) {
    var index = findTop(html),
      strs = _.flattenDeep(_.map(components, function (component) {
        return getComponentStyles(component);
      }));

    wrapComments(strs, 'Stylesheets');

    html = splice(html, index, strs);

    return html;
  };
}

/**
 * Append at the bottom of the body tag, or if no body tag, then the bottom of the root tag.
 * @param {object} data
 * @returns {function}
 */
function appendBottom(data) {
  var components = data.components;
  return function (html) {
    var index = findBottom(html),
      strs = _.flattenDeep(_.map(components, function (component) {
        return getComponentScripts(component);
      }));

    wrapComments(strs, 'Scripts');

    html = splice(html, index, strs);

    return html;
  };
}

module.exports.appendTop = appendTop;
module.exports.appendBottom = appendBottom;