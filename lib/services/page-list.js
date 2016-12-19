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
  index = 'pages',
  acceptedIcons = ['icon.120x120.png', 'icon.180x180', 'icon.192x192.png'];

/**
 * Filter out ops that aren't `pages` and `puts`
 * @param  {Array} ops
 * @return {Array}
 */
function filterOps(ops) {
  ops = _.filter(ops, filters.isPageOp);
  return ops = _.filter(ops, filters.isPutOp);
}

/**
 * Handler for batch event. Filter out unwanted ops,
 * construct page data and then send document to ES.
 *
 * TODO: Better to just update a document or should it be tested that it exists? Probably bad for overriding the title...?
 *
 * @param  {Object} mappings
 * @return {Function}
 */
function updatePageList(mappings) {
  return function (batchOps) {
    return search.applyOpFilters(batchOps, mappings, index, filterOps)
      .then(function (resp) {
        var resp = resp[0][0],
          filteredOps = resp.ops,
          mapping = resp.mapping,
          typeName = resp.typeName;

        if (filteredOps.length) {
          return pageExists(filteredOps)
            .then(function (existsArr) {
              var dividedOps = pairOpWithExisting(filteredOps, existsArr);

              if (dividedOps.existing.length) {
                return updateExistingPageData(dividedOps.existing);
              } else {
                return search.batch(search.convertRedisBatchtoElasticBatch(index, typeName, constructPageData(mapping, filteredOps)));
              }
            });
        }
      });
  };
}

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
  return search.client.get({
    index: 'pages',
    type: 'general',
    id: pageUri
  });
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
 * @return {[type]}     [description]
 */
function updateExistingPageData(ops) {
  return bluebird.all(_.map(ops, function (op) {
    return getPage(pageUriFromKey(op.key))
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

        return updatePageData(resp._id, updateData);
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
    return search.client.exists({
      index: 'pages',
      type: 'general',
      id: pageUriFromKey(op.key)
    });
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

  return search.client.update({
    index: 'pages',
    type: 'general',
    id: pageUri,
    body: {
      doc: data
    }
  }).then(function (result) {
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


  files.getFiles();

  _.each(sites.sites(), function (site) {
    var mediaDir = path.resolve(process.cwd(), site.assetDir, 'media', 'sites', site.slug),
      mediaDirFiles = files.getFiles(mediaDir),
      icons = _.intersection(acceptedIcons, mediaDirFiles); // https://lodash.com/docs/4.17.2#intersection

    ops.push({
      index: {
        _index: 'sites', // Hardcoded because we know the index we need
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
      siteIcon: `${icons ? icons[0] : ''}`
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

/**
 * Return all entries in the 'pages' index
 *
 * @param  {Object} req
 * @param  {Object} res
 */
function getPageList(req, res) {
  responses.expectJSON(function () {
    return search.query('pages', {}, 'general')
      .then(resp => resp.hits);
  }, res);
}

/**
 * Return all entries in the 'sites' index
 *
 * @param  {Object} req
 * @param  {Object} res
 */
function getSiteList(req, res) {
  responses.expectJSON(function () {
    return search.query('sites', {}, 'general')
      .then(resp => resp.hits);
  }, res);
}

function searchPages(req, res) {
  responses.expectJSON(function () {
    return search.query('pages', validatePayload(req.body), 'general')
      .then(resp => resp.hits);
  }, res);
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

module.exports.updatePageList = updatePageList;
module.exports.sitesIndex = sitesIndex;
module.exports.getPageList = getPageList;
module.exports.getSiteList = getSiteList;
module.exports.searchPages = searchPages;
/**
 * TODO: Validate stuff
 * @param  {[type]} pageUri [description]
 * @param  {[type]} title   [description]
 * @return {[type]}         [description]
 */
module.exports.pageTitleService = function (pageUri, title) {
  if (!_.isString(title)) {
    throw new Error('Expected title to be a String, but got: ', title);
  }

  // Let's truncate the string to only be 75 characters + '...';
  return updatePageData(pageUri, {title: _.truncate(title, {
    length: 75
  })});
};

module.exports.pageAuthorsService = function (pageUri, authors) {
  if (!_.isArray(authors)) {
    throw new Error('Expected authors to be an Array but got: ', authors);
  }

  return updatePageData(pageUri, {authors: authors});
};

