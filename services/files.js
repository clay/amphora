'use strict';
var fs = require('fs'),
  path = require('path');

/**
 * get folder names
 * @param  {string} dir enclosing folder
 * @return {[]}     array of folder names
 */
module.exports.getFolders = function (dir) {
  if (fs.existsSync(dir)) {
    return fs.readdirSync(dir)
      .filter(function (file) {
        return fs.statSync(path.join(dir, file)).isDirectory();
      });
  } else {
    return [];
  }
};
