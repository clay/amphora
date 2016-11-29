'use strict';

const bluebird = require('bluebird'),
  _ = require('lodash'),
  sites = require('./sites'),
  url = require('url'),
  filters = require('../elastic/db-filters'),
  elasticHelpers = require('../elastic/helpers'),
  search = require('./search'),
  index = 'pages';

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
          return search.batch(search.convertRedisBatchtoElasticBatch(index, typeName, constructPageData(mapping, filteredOps)));
        }
      });
  };
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
      site = findSite(op.key);

    return {
      type: op.type,
      key: op.key.split('@')[0],
      value: {
        uri: `${site.host}${site.path}${op.key.split(site.path)[1]}`,
        published: filters.isPublished(op),
        scheduled: filters.isScheduled(op),
        url: _.get(data, 'url', ''),
        title: '',
        siteSlug: site.slug
      }
    };
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
      assetPath: site.assetPath
    });
  });

  return search.batch(ops);
}

/**
 * Set the title for a page in the page list.
 * Hardcoded values because we know exactly what
 * index's document we're updating
 *
 * @param {String} pageUri
 * @param {String} title
 */
function setPageName(pageUri, title) {
  return search.client.update({
    index: 'pages',
    type: 'general',
    id: pageUri,
    body: {
      doc: {
        title: title
      }
    }
  }).then(function (result) {
    log('info', 'Page name updated for', result._id, ':', title);
  }).catch(function (error) {
    log('error', error.stack);
  });
}

module.exports.updatePageList = updatePageList;
module.exports.sitesIndex = sitesIndex;
module.exports.setPageName = setPageName;
