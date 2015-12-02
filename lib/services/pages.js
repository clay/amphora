'use strict';

const _ = require('lodash'),
  components = require('../services/components'),
  db = require('../services/db'),
  bluebird = require('bluebird'),
  composer = require('../composer'),
  references = require('../services/references'),
  siteService = require('./sites'),
  notifications = require('./notifications'),
  uid = require('../uid');

/**
 * @param {string} uri
 * @param {{}} data
 * @param {[]} ops
 */
function addOp(uri, data, ops) {
  ops.push({
    type: 'put',
    key: uri,
    value: JSON.stringify(data)
  });

  return ops;
}

/**
 * True of reference object has a string in _ref that includes "/instances/"
 * @param {object} data
 * @returns {boolean}
 */
function isInstanceReferenceObject(data) {
  return _.isString(data._ref) && data._ref.indexOf('/instances/') > -1;
}

/**
 * Get the prefix of a page like 'some-domain.com/some-path/pages/' with the page id.
 *
 * @param {string} uri
 * @returns {string}
 */
function getPrefix(uri) {
  return uri.substr(0, uri.indexOf('/pages/'));
}

/**
 * Get a reference that is unique, but of the same component type as original.
 * @param {string} uri
 * @returns {string}
 */
function renameReferenceUniquely(uri) {
  const prefix = uri.substr(0, uri.indexOf('/components/'));

  return prefix + '/components/' + components.getName(uri) + '/instances/' + uid();
}

/**
 * Clone all instance components that are referenced by this page data, and maintain the data's object structure.
 *
 * @param {object} pageData
 * @param {object} [locals]
 * @returns {Promise}
 */
function getPageClonePutOperations(pageData, locals) {
  return bluebird.all(_.reduce(pageData, function (promises, pageValue, pageKey) {
    if (typeof pageValue === 'string' && components.getName(pageValue)) {
      //for all strings that are component references
      promises.push(components.get(pageValue, locals).then(function (refData) {
        //only follow the paths of instance references.  Don't clone default components
        return composer.resolveComponentReferences(refData, isInstanceReferenceObject);
      }).then(function (resolvedData) {
        //for each instance reference within resolved data
        _.each(_.listDeepObjects(resolvedData, isInstanceReferenceObject), function (obj) {
          obj._ref = renameReferenceUniquely(obj._ref);
        });

        //rename reference in pageData
        const ref = renameReferenceUniquely(pageValue);
        pageData[pageKey] = ref;

        //put new data using cascading PUT at place that page now points
        return components.getPutOperations(ref, resolvedData, locals);
      }));
    } else {
      //for all object-like things (i.e., objects and arrays)
      promises = promises.concat(getPageClonePutOperations(pageValue, locals));
    }
    return promises;
  }, [])).then(_.flatten); //only one level of flattening needed
}

/**
 * Applies operations, then returns last (root) op's value.
 *
 * @param {object} site
 */
function applyBatch(site) {
  return function (ops) {
    const lastOp = _.last(ops),
      lastValue = lastOp && JSON.parse(lastOp.value);

    return db.batch(ops).then(function () {
      // if published, notify listeners
      if (_.endsWith(lastOp.key, '@published')) {
        notifications.notify(site, 'published', lastValue);
      }
    }).return(lastValue);
  };
}

/**
 * Replace the referenced things in the page data with a different version
 * @param {object} data
 * @param {string} version
 * @returns object
 */
function replacePageReferenceVersions(data, version) {
  const replaceVersion = _.partial(references.replaceVersion, _, version);

  return _.mapValues(data, function (value) {
    if (references.isUri(value)) {
      return replaceVersion(value);
    } else if (_.isArray(value)) {
      return _.map(value, replaceVersion);
    } else {
      return value;
    }
  });
}

/**
 * Get latest data of uri@latest
 * @param {string} uri
 * @returns {Promise}
 */
function getLatestData(uri) {
  return db.get(references.replaceVersion(uri)).then(JSON.parse);
}

/**
 * Get a list of all operations with all references converted to @published
 * @returns {function}
 */
function getRecursivePublishedPutOperations(locals) {
  return function (rootComponentRef) {
    const published = 'published';

    /**
     * 1) Get reference (could be latest, could be other)
     * 2) Get all references within reference
     * 3) Replace all references with @published (including root reference)
     * 4) Get list of put operations needed
     */
    return components.get(rootComponentRef, locals)
      .then(composer.resolveComponentReferences)
      .then(references.replaceAllVersions(published))
      .then(function (data) {
        return components.getPutOperations(references.replaceVersion(rootComponentRef, published), data, locals);
      });
  };
}

function getSite(prefix, locals) {
  const site = locals && locals.site;

  return site || siteService.getSiteFromPrefix(prefix);
}

/**
 * Publish a uri
 * @param {string} uri
 * @param {object} [data]
 * @param {object} [locals]
 * @returns {Promise}
 */
function publish(uri, data, locals) {
  const prefix = getPrefix(uri),
    site = getSite(prefix, locals);

  return bluebird.try(function () {
    return data || getLatestData(uri);
  }).then(function (data) {
    const published = 'published',
      canonicalUrl = data.url,
      componentList = _.flatten(_.values(_.omit(data, ['layout', 'url'])));

    if (!references.isUrl(canonicalUrl)) {
      throw new Error('Client: Page must have valid url to publish.');
    }

    return bluebird.map(componentList, getRecursivePublishedPutOperations(locals))
      .then(_.flatten) // only one level of flattening needed, because getPutOperations should have flattened its list already
      .then(function (ops) {
        // convert the data to all @published
        data = replacePageReferenceVersions(data, published);

        // make public
        ops.push({
          type: 'put',
          key: prefix + '/uris/' + new Buffer(canonicalUrl).toString('base64'),
          value: uri
        });

        // add page PUT operation last
        return addOp(references.replaceVersion(uri, published), data, ops);
      });
  }).then(applyBatch(site));
}

/**
 * First draft
 * @param {string} uri
 * @param {object} data
 * @param {object} [locals]
 * @returns {Promise}
 */
function create(uri, data, locals) {
  const layoutReference = data && data.layout,
    pageData = data && _.omit(data, 'layout'),
    prefix = uri.substr(0, uri.indexOf('/pages')),
    site = getSite(prefix, locals),
    pageReference = prefix + '/pages/' + uid();

  if (!layoutReference) {
    throw new Error('Client: Data missing layout reference.');
  }

  return components.get(layoutReference, locals).then(function () {

    return getPageClonePutOperations(pageData).then(function (ops) {
      pageData.layout = layoutReference;

      return addOp(pageReference, pageData, ops);
    });
  }).then(applyBatch(site)).then(function (newPage) {
    // if successful, return new page object, but include the (optional) self reference to the new page.
    newPage._ref = pageReference;
    return newPage;
  });
}

module.exports.create = create;
module.exports.publish = publish;
module.exports.replacePageReferenceVersions = replacePageReferenceVersions;
