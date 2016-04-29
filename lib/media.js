'use strict';

const _ = require('lodash'),
  components = require('./services/components'),
  mediaMapProperty = 'media',
  path = require('path'),
  files = require('./files'),
  bluebird = require('bluebird'),
  styleTag = 'style',
  scriptTag = 'scripts',
  currentDir = process.cwd();

/**
 * @param {Array} list
 * @param {function} fn
 * @returns {Array}
 */
function flatMap(list, fn) {
  return _.filter(_.flattenDeep(_.map(list, fn)), _.identity);
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
  return str.substr(0, index) + items + str.substr(index);
}

/**
 * Get the contents of a string that come after specified characters.
 *
 * @param  {string} str Any string to split
 * @param  {string} dir The directory the file is in
 * @return {string}
 */
function getFileName(str, dir) {
  return str.split(dir)[1];
}

/**
 * Retrieve the contents of a file
 *
 * @param  {array} fileArray   An array of file names
 * @param  {string} targetDir  The directory to retrieve files from
 * @param  {string} filePrefix The string that comes right before the file name
 * @return {Promise}
 */
function getContentsOfFiles(fileArray, targetDir, filePrefix) {
  var allPromises = [];

  fileArray.forEach(file => {
    allPromises.push(files.readFilePromise(path.join(currentDir, targetDir, getFileName(file, filePrefix))));
  });

  return Promise.all(allPromises)
    .catch(err => {
      throw err;
    });
}

/**
 * Wraps a string with HTML tags
 * @param  {string} string The string to wrap
 * @param  {string} tag    The HTML tag to use
 * @return {string}
 */
function wrapWithTags(string, tag) {
  if (tag === scriptTag) {
    return `<script type="text/javascript">${string}</script>`;
  } else {
    return `<style>${string}</style>`;
  }
}

/**
 * Concatenates an array of files into one string.
 *
 * @param  {array} fileArray   An array of files
 * @param  {string} directory  The directory in which `fs` will look for the file
 * @param  {string} filePrefix The directory path before the filename
 * @param  {string|null} tag   The type of tag to wrap the contents in.
 * @return {string}
 */
function combineFileContents(fileArray, directory, filePrefix) {
  if (!fileArray || !fileArray.length) {
    return false;
  }

  // If there are files, retrieve contents
  return getContentsOfFiles(fileArray, directory, filePrefix);
}

/**
 * Append at the bottom of the head tag, or if no head tag, then the top of root tag.
 *
 * @param {array} styles
 * @param {string} fonts
 * @param {string} html
 * @param {string} tag
 * @returns {string}
 */
function appendMediaToTop(styles, fonts, html, tag) {
  var index = findTop(html),
    combinedStyles = fonts + styles.join(''),
    wrappedStyles = wrapWithTags(combinedStyles, tag);

  return splice(html, index, wrappedStyles);
}

/**
 * Append at the bottom of the body tag, or if no body tag, then the bottom of the root tag.
 * @param {Array} scripts
 * @param {string} html
 * @param {string} tag
 * @returns {string}
 */
function appendMediaToBottom(scripts, html, tag) {
  var index = findBottom(html),
    wrappedScripts = wrapWithTags(scripts.join(''), tag);

  return splice(html, index, wrappedScripts);
}

/**
 * Get the fonts for the site to be inlined
 * @param  {Object} site
 * @return {Promise}
 */
function getFonts(site) {
  var pathToFontCSS = path.join(currentDir, site.assetDir, 'fonts', `combined-${site.slug}.css`);

  // Return a promise for reading the file's contents
  return files.readFilePromise(pathToFontCSS)
    .catch(function () {
      // If there was an error reading from the file
      // because it doesn't exist, return an empty string
      return '';
    });
}

/**
 * @param {object} data
 * @param {object} locals
 * @returns {Promise}
 */
function append(data, locals) {
  const mediaMap = data[mediaMapProperty];

  // assertion
  if (!_.isObject(mediaMap)) {
    return _.identity;
  }

  return function (html) {
    // assertion
    if (!_.isString(html)) {
      throw new Error('Missing html parameter');
    }

    return bluebird.props({
      fonts: getFonts(locals.site),
      styles: combineFileContents(mediaMap.styles, `${locals.site.assetDir}/css`, '/css/'),
      scripts: combineFileContents(mediaMap.scripts, `${locals.site.assetDir}/js`, '/js/')
    }).then(combinedFiles => {
      html = combinedFiles.styles ? appendMediaToTop(combinedFiles.styles, combinedFiles.fonts, html, styleTag) : html;     // If there are styles, append them
      html = combinedFiles.scripts ? appendMediaToBottom(combinedFiles.scripts, html, scriptTag) : html; // If there are scripts, append them
      return html;                                                                           // Return the compiled HTML
    });
  };
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
  let site, mediaMap;

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
