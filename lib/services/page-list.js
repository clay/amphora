'use strict';

const bluebird = require('bluebird'),
  _ = require('lodash'),
  sites = require('./sites'),
  filters = require('../elastic/db-filters'),
  elasticHelpers = require('../elastic/helpers'),
  search = require('./search');

function updatePageList(mappings) {
  return function (batchOps) {
    return bluebird.all(_.map(_.pick(mappings, ['pages']), function (types, indexName) {
      return bluebird.all(_.map(types, function (mapping, typeName) {
        var ops = _.cloneDeep(batchOps);

        // more filters will undoubtably go here
        ops = _.filter(ops, filters.isOpForPage);
        ops = _.filter(ops, filters.isOpForPut);

        if (ops.length > 0) {
          return search.batch(elasticHelpers.convertRedisBatchtoElasticBatch(indexName, typeName, constructPageData(mapping, ops)));
        }
      }));
    }));
  };
}

function constructPageData(mapping, ops) {
  return _.map(ops, function (op) {
    var data = JSON.parse(op.value),
      site = sites.getSiteFromPrefix(op.key);

    return {
      type: op.type,
      key: op.key.split('@')[0],
      value: {
        uri: `${site.host}:${site.port}${site.path}${op.key.split(site.path)[1]}`,
        published: filters.isPublished(op),
        scheduled: filters.isScheduled(op),
        url: _.get(data, 'url', ''),
        title: '',
        site: {
          name: site.name,
          slug: site.slug,
          host: site.host,
          path: site.path,
          port: site.port,
          assetDir: site.assetDir,
          assetPath: site.assetPath
        }
      }
    };
  });
}

module.exports.updatePageList = updatePageList;

