'use strict';

const pageList = require('./lib/services/page-list');

// services exposed to outside
module.exports = require('./lib/setup');
module.exports.db = require('./lib/services/db');
module.exports.search = require('./lib/services/search');
module.exports.composer = require('./lib/services/composer');
module.exports.components = require('./lib/services/components');
module.exports.schedule = require('./lib/services/schedule');
module.exports.pages = require('./lib/services/pages');
module.exports.sites = require('./lib/services/sites');
module.exports.references = require('./lib/services/references');
module.exports.log = require('./lib/services/log');

// Page List services
module.exports.pageTitleService = pageList.pageTitleService;
module.exports.pageAuthorsService = pageList.pageAuthorsService;
