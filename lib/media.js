'use strict';

var _ = require('lodash'),
  components = require('./services/components'),
  mediaMapProperty = '_mediaMap';

function flatMap(list, fn) {
  return _.filter(_.flattenDeep(_.map(list, fn)), _.identity);
}

/**
 * @param {Array} list
 * @param {string} name
 */
function wrapComments(list, name) {
  list.unshift('\n<!-- ' + name + ' Begin -->');
  list.push('<!-- ' + name + ' End -->\n');
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
 * @param {{styles: Array, scripts: Array}} mediaMap
 * @param {string} html
 * @returns {function}
 */
function appendMediaToTop(mediaMap, html) {
  var index = findTop(html),
    items = flatMap(mediaMap.styles, function (mediaPath) {
      return '<link rel="stylesheet" type="text/css" href="' + mediaPath + '" />';
    });

  wrapComments(items, 'Stylesheets');

  return splice(html, index, items);
}

/**
 * Append at the bottom of the body tag, or if no body tag, then the bottom of the root tag.
 * @param {{styles: Array, scripts: Array}} mediaMap
 * @param {string} html
 * @returns {function}
 */
function appendMediaToBottom(mediaMap, html) {
  var index = findBottom(html),
    items = flatMap(mediaMap.scripts, function (mediaPath) {
      return '<script type="text/javascript" src="' + mediaPath + '"></script>';
    });

  wrapComments(items, 'Scripts');

  return splice(html, index, items);
}

function append(data) {
  var mediaMap = data[mediaMapProperty],
    tasks = [];

  if (mediaMap) {
    if (mediaMap.styles && mediaMap.styles.length > 0) {
      tasks.push(_.partial(appendMediaToTop, mediaMap));
    }

    if (mediaMap.scripts && mediaMap.scripts.length > 0) {
      tasks.push(_.partial(appendMediaToBottom, mediaMap));
    }
  }

  return _.compose.apply(_, tasks);
}

/**
 * Gets a list of all css and js needed for the components listed.
 *
 * NOTE: the getStyles and getScripts are memoized using all arguments
 *
 * @param {Array} componentList
 * @param {string} slug
 * @returns {{styles: Array, scripts: Array}}
 */
function getMediaMap(componentList, slug) {
  var mediaMap = {};

  mediaMap.styles = flatMap(componentList, function (component) {
    return components.getStyles(component, slug);
  });

  mediaMap.scripts = flatMap(componentList, function (component) {
    return components.getScripts(component, slug);
  });

  return mediaMap;
}

module.exports.append = append;
module.exports.getMediaMap = getMediaMap;
module.exports.mediaMapProperty = mediaMapProperty;
