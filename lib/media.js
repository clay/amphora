'use strict';

var _ = require('lodash'),
  components = require('./services/components'),
  mediaMapProperty = 'media';

/**
 * @param {Array} list
 * @param {function} fn
 * @returns {Array}
 */
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
  var body = str.lastIndexOf('</body>'),
    script = str.indexOf('<script>'),
    closeTag = str.lastIndexOf('</');

  if (body > -1) {
    return body; // right before body closes
  } else if (script > -1) {
    return script; // right before FIRST inline script
  } else {
    return closeTag; // right before last tag closes
  }
}

/**
 * @param {string} str
 * @returns {number}
 */
function findTop(str) {
  var head = str.indexOf('</head>'), // right before head closes
    style = str.indexOf('<style>'), // right before inline styles
    closeTag = str.indexOf('>'); // right after first tag

  if (head > -1) {
    return head;
  } else if (style > -1) {
    return style;
  } else {
    return closeTag + 1;
  }
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

/**
 * @param {object} data
 * @returns {object}
 */
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
  return {
    styles: flatMap(componentList, function (component) {
      return components.getStyles(component, slug);
    }),
    scripts: flatMap(componentList, function (component) {
      return components.getScripts(component, slug);
    })
  };
}

/**
 *
 * @param {Array} componentList
 * @param {object} data
 * @param {object} locals
 * @param {object} locals.site
 * @returns {{styles: Array, scripts: Array}}
 */
function addMediaMap(componentList, data, locals) {
  var site, mediaMap;

  if (!_.has(locals, 'site.slug')) {
    throw new TypeError('Locals with site slug are required to add media map.');
  }

  site = locals.site;
  mediaMap = getMediaMap(componentList, site.slug);

  // allow site to change the media map before applying it
  if (_.isFunction(site.resolveMedia)) {
    mediaMap = site.resolveMedia(mediaMap, locals) || mediaMap;
  }

  // add the lists of media to the data to be processed
  if (mediaMap.styles.length > 0 || mediaMap.scripts.length > 0) {
    data[mediaMapProperty] = mediaMap;
  }

  return mediaMap;
}

module.exports.append = append;
module.exports.getMediaMap = getMediaMap;
module.exports.addMediaMap = addMediaMap;
