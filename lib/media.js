'use strict';

var _ = require('lodash'),
  bluebird = require('bluebird'),
  files = require('./files');

function getComponentStyles(component) {
  return ['<link rel="stylesheet" type="text/css" href="/css/' + component + '.css"></link>'];
}

function getComponentScripts(component) {
  return ['<script type="text/javascript" src="/js/' + component + '.js"></script>'];
}

/**
 * Finds index of first thing or second thing
 *
 * @param {[string]} target
 * @param {string} first
 * @param {string} second
 */
function findBottom(target) {
  var index = target[0].lastIndexOf('</body');
  if (index === -1) {
    index = target[0].lastIndexOf('</');
  }
  return index;
}

function findTop(target) {
  var index = target[0].indexOf('</head');
  if (index === -1) {
    index = target[0].indexOf('>') + 1;
  }
  return index;
}

/**
 * Put items at index in the very large target string.
 *
 * @param {[string]} target
 * @param {number} index
 * @param {[string]} items
 * @returns {[string]}
 */
function splice(target, index, items) {
  target[0] = target[0].substr(0, index) + _.flattenDeep(items).join('') + target[0].substr(index);
  console.log('splice', target[0].substr(0, index), _.flattenDeep(items).join(''), target[0].substr(index));
  return target;
}

/**
 * Append at the bottom of the head tag, or if no head tag, then the top of root tag.
 *
 * @param data
 */
function appendTop(data) {
  var components = data.components;
  return function (target) {

    console.log('appendTop', data.components);

    var index = findTop(target),
      strs = _.map(components, function (component) {
        console.log(component, getComponentStyles(component));
        return getComponentStyles(component);
      });

    return splice(target, index, strs);
  };
}

/**
 * Append at the bottom of the body tag, or if no body tag, then the bottom of the root tag.
 * @param data
 * @returns {Function}
 */
function appendBottom(data) {
  var components = data.components;
  return function (target) {
    var index = findBottom(target),
      strs = _.map(components, function (component) {
        return getComponentScripts(component);
      });
    return splice(target, index, strs);
  };
}

module.exports.appendTop = appendTop;
module.exports.appendBottom = appendBottom;