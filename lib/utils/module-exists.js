'use strict';

module.exports = function (modulePath) {
  try {
    require(modulePath);
  } catch(e) {
    return;
  }

  return require(modulePath);
};
