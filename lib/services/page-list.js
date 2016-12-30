'use strict';

const bluebird = require('bluebird'),
  _ = require('lodash'),
  log = require('../services/log').withStandardPrefix(__dirname),
  sites = require('./sites'),
  url = require('url'),
  path = require('path'),
  filters = require('../elastic/db-filters'),
  search = require('./search'),
  responses = require('../responses'),
  files = require('../files'),
  acceptedIcons = ['icon.120x120.png', 'icon.180x180', 'icon.192x192.png'],
  PREFIX = process.env.ELASTIC_PREFIX ? `${process.env.ELASTIC_PREFIX}-` : '',
  PAGES_INDEX = `${PREFIX}pages`,
  SITES_INDEX = `${PREFIX}sites`;

/**
 * Filter out ops that aren't `pages` and `puts`
 * @param  {Array} ops
 * @return {Array}
 */
function filterForPageOps(ops) {
  ops = _.filter(ops, filters.isPageOp);
  return ops = _.filter(ops, filters.isPutOp);
}

/**
 * Handler for batch event. Filter out unwanted ops,
 * construct page data and then send document to ES.
 *
 * @param  {Object} mappings
 * @return {Function}
 */
function updatePageList(mappings) {
  return function (batchOps) {
    return search.applyOpFilters(batchOps, mappings, PAGES_INDEX, filterForPageOps)
      .then(function (resp) {
        var resp = resp[0][0],
          filteredOps = resp.ops,
          mapping = resp.mapping,
          typeName = resp.typeName;

        return module.exports.pageExists(filteredOps)
          .then(function (existsArr) {
            var dividedOps = pairOpWithExisting(filteredOps, existsArr);

            if (dividedOps.existing.length) {
              return updateExistingPageData(dividedOps.existing);
            } else {
              return search.batch(search.convertRedisBatchtoElasticBatch(PAGES_INDEX, typeName, constructPageData(mapping, filteredOps)));
            }
          });
      });
  };
}

/**
 * [pairOpWithExisting description]
 * @param  {[type]} ops      [description]
 * @param  {[type]} existing [description]
 * @return {[type]}          [description]
 */
function pairOpWithExisting(ops, existing) {
  var pairings = { existing: [], new: [] };

  _.each(existing, function (value, index) {
    value ? pairings.existing.push(ops[index]) : pairings.new.push(ops[index]);
  });

  return pairings;
}

/**
 * [getPage description]
 * @param  {[type]} pageUri [description]
 * @return {[type]}         [description]
 */
function getPage(pageUri) {
  return search.getDocument(PAGES_INDEX, 'general', pageUri);
}

/**
 * [pageUriFromKey description]
 * @param  {[type]} key [description]
 * @return {[type]}     [description]
 */
function pageUriFromKey(key) {
  return key.split('@')[0];
}

/**
 * [updateExistingPageData description]
 * @param  {[type]} ops [description]
 * @return {Promise}
 */
function updateExistingPageData(ops) {
  return bluebird.all(_.map(ops, function (op) {
    return module.exports.getPage(pageUriFromKey(op.key))
      .then(function (resp) {
        var source = resp._source, // Values currently in Elastic
          data = JSON.parse(_.get(op, 'value')), // Get the op values
          published = filters.isPublished(op), // Are we publishing?
          scheduled = filters.isScheduled(op), // Are we scheduling?
          scheduledTime = scheduled ? new Date(data.at) : null, // If scheudled, when is it scheduled for?
          updateData = {};

        // Update specific properties
        updateData.published = source.published || published;
        updateData.scheduled = scheduled;
        updateData.scheduledTime = scheduledTime;
        updateData.url = data.url ? data.url : source.url;
        updateData.publishTime = published ? new Date() : source.publishTime;

        return module.exports.updatePageData(resp._id, updateData);
      });
  }));
}

/**
 * [pageExists description]
 * @param  {[type]} ops [description]
 * @return {[type]}     [description]
 */
function pageExists(ops) {
  return bluebird.all(_.map(ops, function (op) {
    return search.existsDocument(PAGES_INDEX, 'general', pageUriFromKey(op.key));
  }));
}

/**
 * Find the proper site object using the sites service.
 *
 * @param  {String} key
 * @return {Object}
 */
function findSite(key) {
  var site = sites.getSiteFromPrefix(key),
    parsedUrl;

  // If the site is not found from the prefix we need to
  // use the `host` value to find it.
  if (!site) {
    // Make sure it's prefixed with `//` so it can get parsed properly
    // (Usually a problem when working locally)
    key = _.includes(key, '//') ? key : `//${key}`;
    parsedUrl = url.parse(key, true, true);
    site = sites.getSite(parsedUrl.host, '');
  }

  return site;
}

/**
 * Create the data about the page.
 *
 * @param  {Object} mapping
 * @param  {Array} ops
 * @return {Array}
 */
function constructPageData(mapping, ops) {
  return _.map(ops, function (op) {
    var data = JSON.parse(op.value),
      site = findSite(op.key),
      published = filters.isPublished(op),
      scheduled = filters.isScheduled(op),
      scheduledTime = scheduled ? new Date(data.at) : null,
      publishTime = published ? new Date() : null;

    return {
      type: op.type,
      key: pageUriFromKey(op.key),
      value: {
        uri: `${site.host}${site.path}${op.key.split(site.path)[1]}`,
        published: published,
        scheduled: scheduled,
        scheduledTime: scheduledTime,
        publishTime: publishTime,
        url: _.get(data, 'url', ''),
        title: '',
        authors: [],
        siteSlug: site.slug
      }
    };
  });
}

function updatePageData(pageUri, data) {
  if (!data) {
    throw new Error('Updating a page requires a data object');
  }

  return search.update(PAGES_INDEX, 'general', pageUri, data)
    .then(function (result) {
      log('info', 'Page data updates for page:', result._id);
    }).catch(function (error) {
      log('error', error.stack);
    });
}

/**
 * Populate the internal sites index with all the
 * sites included in the instance.
 *
 * @return {Promise}
 */
function sitesIndex() {
  var ops = []; // To be populated with Elastic ops for each site

  _.each(sites.sites(), function (site) {
    var mediaDir = path.resolve(process.cwd(), site.assetDir, 'media', 'sites', site.slug),
      mediaDirFiles = files.getFiles(mediaDir),
      icons = _.intersection(acceptedIcons, mediaDirFiles); // https://lodash.com/docs/4.17.2#intersection

    ops.push({
      index: {
        _index: SITES_INDEX, // Hardcoded because we know the index we need
        _type: 'general',
        _id: site.slug
      }
    }, {
      name: site.name,
      slug: site.slug,
      host: site.host,
      path: site.path,
      port: site.port,
      assetDir: site.assetDir,
      assetPath: site.assetPath,
      mediaPath: `${constructMediaPath(site)}`,
      siteIcon: `${icons[0]}`
    });
  });

  return search.batch(ops);
}

/**
 * Create the path to the m
 *
 * @param  {Object} site
 * @return {String}
 */
function constructMediaPath(site) {
  // For local development we want the user defined port
  var port = site.port === 80 ? '' : ':' + site.port;

  // Some sites, if they not in subdirectories of a main site, will not
  // have an asset path. If no asset path then just use the site slug.
  return `${site.host}${port}${site.assetPath}/media/sites${site.assetPath || '/' + site.slug}/`;
}

function getAllPages() {
  return search.query(PAGES_INDEX, {}, 'general')
    .then(resp => resp.hits);
}

function getAllSites() {
  return search.query(SITES_INDEX, {}, 'general')
    .then(resp => resp.hits);
}

function queryPages(reqBody) {
  return function () {
    return search.query(PAGES_INDEX, validatePayload(reqBody), 'general')
      .then(resp => resp.hits);
  }
}

/**
 * Return all entries in the pages index
 *
 * @param  {Object} req
 * @param  {Object} res
 */
function getPageList(req, res) {
  responses.expectJSON(getAllPages, res);
}

/**
 * Return all entries in the 'sites' index
 *
 * @param  {Object} req
 * @param  {Object} res
 */
function getSiteList(req, res) {
  responses.expectJSON(getAllSites, res);
}

/**
 * [searchPages description]
 * @param  {[type]} req [description]
 * @param  {[type]} res [description]
 * @return {[type]}     [description]
 */
function searchPages(req, res) {
  responses.expectJSON(queryPages(req.body), res);
}

/**
 * [validatePayload description]
 * TODO: Figure out why every payload isn't stringified (postman vs from kiln)
 * TODO: Pass through Dalia's validate API
 * @param  {[type]} payload [description]
 * @return {[type]}         [description]
 */
function validatePayload(payload) {
  return _.isString(payload) ? JSON.parse(payload).body : payload.body;
}

/**
 * TODO: Validate stuff
 * @param  {[type]} pageUri [description]
 * @param  {[type]} title   [description]
 * @return {[type]}         [description]
 */
function pageTitleService(pageUri, title) {
  if (!title || !_.isString(title)) {
    throw new Error('Expected title {String}, but got: ', title);
  } else if (!pageUri || !_.isString(pageUri)) {
    throw new Error('Expected pageUri {String}, but got: ', pageUri);
  }

  // Let's truncate the string to only be 75 characters + '...';
  return module.exports.updatePageData(pageUri, {
    title: _.truncate(title, {
      length: 75
    })
  });
};

/**
 * [pageAuthorsService description]
 * @param  {[type]} pageUri [description]
 * @param  {[type]} authors [description]
 * @return {[type]}         [description]
 */
function pageAuthorsService(pageUri, authors) {
  if (!_.isArray(authors)) {
    throw new Error('Expected authors {Array} but got: ', authors);
  } else if (!pageUri || !_.isString(pageUri)) {
    throw new Error('Expected pageUri {String}, but got: ', pageUri);
  }

  return module.exports.updatePageData(pageUri, { authors: authors });
};

module.exports.updatePageData = updatePageData;
module.exports.updatePageList = updatePageList;
module.exports.pageExists = pageExists;
module.exports.sitesIndex = sitesIndex;
module.exports.getPage = getPage;
module.exports.getPageList = getPageList;
module.exports.getSiteList = getSiteList;
module.exports.searchPages = searchPages;
module.exports.pageTitleService = pageTitleService;
module.exports.pageAuthorsService = pageAuthorsService;

// For testing
module.exports.filterForPageOps = filterForPageOps;
module.exports.searchPages = searchPages;
module.exports.getAllPages = getAllPages;
module.exports.getAllSites = getAllSites;
module.exports.queryPages = queryPages;
module.exports.updateExistingPageData = updateExistingPageData;
module.exports.findSite = findSite;
module.exports.constructMediaPath = constructMediaPath;
module.exports.validatePayload = validatePayload;
