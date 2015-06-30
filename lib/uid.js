'use strict';

var Flake = require('flake-idgen'),
  flake = new Flake();

function getUniqueId() {
  return flake.next().toString('base64');
}

module.exports = getUniqueId;
