'use strict';

module.exports.getMillisecondsSince = function (hrStart) {
  const diff = process.hrtime(hrStart);

  return Math.floor((diff[0] * 1e9 + diff[1]) / 1000000);
};
