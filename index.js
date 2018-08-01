'use strict';

// services exposed to outside
module.exports = require('./lib/setup');
module.exports.db = require('./lib/services/db');
module.exports.composer = require('./lib/services/composer');
module.exports.components = require('./lib/services/components');
module.exports.pages = require('./lib/services/pages');
module.exports.sites = require('./lib/services/sites');
module.exports.references = require('./lib/services/references');
