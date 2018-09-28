'use strict';

var timeoutConstant = 4000,
  log = require('./logger').setup({
    file: __filename
  }),
  db = require('./db');
const _ = require('lodash'),
  buf = require('./buffer'),
  bluebird = require('bluebird'),
  components = require('./components'),
  layouts = require('./layouts'),
  composer = require('./composer'),
  notifications = require('./notifications'),
  references = require('./references'),
  siteService = require('./sites'),
  timer = require('../timer'),
  uid = require('../uid'),
  meta = require('./metadata'),
  dbOps = require('./db-operations'),
  { getComponentName, replaceVersion, getPrefix, isLayout } = require('clayutils'),
  publishService = require('./publish'),
  bus = require('./bus'),
  timeoutPublishCoefficient = 5;

/**
 * @param {string} uri
 * @param {{}} data
 * @param {[]} ops
 * @returns {array}
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
 * Get a reference that is unique, but of the same component type as original.
 * @param {string} uri
 * @returns {string}
 */
function renameReferenceUniquely(uri) {
  const prefix = uri.substr(0, uri.indexOf('/_components/'));

  return `${prefix}/_components/${getComponentName(uri)}/instances/${uid.get()}`;
}

/**
 * Clone all instance components that are referenced by this page data, and maintain the data's object structure.
 *
 * @param {object} pageData
 * @param {object} locals
 * @returns {Promise}
 */
function getPageClonePutOperations(pageData, locals) {
  return bluebird.all(_.reduce(pageData, (promises, pageValue, pageKey) => {
    if (typeof pageValue === 'string' && getComponentName(pageValue)) {
      // for all strings that are component references
      promises.push(components.get(pageValue, locals)
        // only follow the paths of instance references.  Don't clone default components
        .then(refData => composer.resolveComponentReferences(refData, locals, isInstanceReferenceObject))
        .then(resolvedData => {
          // for each instance reference within resolved data
          _.each(references.listDeepObjects(resolvedData, isInstanceReferenceObject), obj => {
            obj._ref = renameReferenceUniquely(obj._ref);
          });

          // rename reference in pageData
          const ref = renameReferenceUniquely(pageValue);

          pageData[pageKey] = ref;

          // put new data using cascading PUT at place that page now points
          return dbOps.getPutOperations(components.cmptPut, ref, resolvedData, locals);
        }));
    } else {
      // for all object-like things (i.e., objects and arrays)
      promises = promises.concat(getPageClonePutOperations(pageValue, locals));
    }
    return promises;
  }, [])).then(_.flatten); // only one level of flattening needed
}

/**
 * Applies operations, then returns last (root) op's value.
 *
 * @param {Array} ops
 * @returns {Promise}
 */
function applyBatch(ops) {
  return db.batch(ops)
    .then(() => bus.publish('save', ops))
    .then(() => {
      const lastOp = _.last(ops);

      return lastOp && JSON.parse(lastOp.value);
    });
}

/**
 * Replace the referenced things in the page data with a different version
 * @param {object} data
 * @param {string} version
 * @returns {object}
 */
function replacePageReferenceVersions(data, version) {
  const replace = _.partial(replaceVersion, _, version);

  return _.mapValues(data, function (value, key) {
    let result;

    if (references.isUri(value)) {
      result = replace(value);
    } else if (_.isArray(value) && key !== 'urlHistory') {
      // urlHistory is an array of old page urls. they're not component refs and shouldn't be versioned
      result = _.map(value, replace);
    } else {
      result = value;
    }
    return result;
  });
}

/**
 * Get a list of all operations with all references converted to @published
 * @param {object} locals
 * @returns {function}
 */
function getRecursivePublishedPutOperations(locals) {
  return rootComponentRef => {
    /**
     * 1) Get reference (could be latest, could be other)
     * 2) Get all references within reference
     * 3) Replace all references with @published (including root reference)
     * 4) Get list of put operations needed
     */
    return components.get(rootComponentRef, locals)
      .then(data => composer.resolveComponentReferences(data, locals))
      .then(data => dbOps.getPutOperations(components.cmptPut, replaceVersion(rootComponentRef, 'published'), data, locals));
  };
}

/**
 * Given either locals or a string,
 * return the site we're working with
 *
 * @param {String} prefix
 * @param {Object} locals
 * @returns {Object}
 */
function getSite(prefix, locals) {
  const site = locals && locals.site;

  return site || siteService.getSiteFromPrefix(prefix);
}

/**
 * Cannot contain any empty value (null, '', undefined, false)
 * @param {object} data
 * @throws
 */
function assertNoEmptyValues(data) {
  _.each(data, function (value) {
    if (!value) {
      throw new Error('Client: page cannot have empty values');
    }
  });

  _.each(references.listDeepObjects(data), assertNoEmptyValues);
}

/**
 * @param {string} uri
 * @param {object} [data]
 * @returns {Promise}
 */
function getPublishData(uri, data) {
  return bluebird.try(() => {
    if (data && _.size(data) > 0) {
      // if they actually gave us something, use it
      assertNoEmptyValues(data);
      return data;
    }
    // otherwise, assume they meant whatever is in @latest
    return db.getLatestData(uri);
  });
}

/**
 *
 * @param {Array} ops
 * @param {string} sitePrefix
 * @param {string} publicUrl
 * @param {string} pageUri
 */
function addOpToMakePublic(ops, sitePrefix, publicUrl, pageUri) {
  // make public
  ops.push({
    type: 'put',
    key: `${sitePrefix}/_uris/${buf.encode(references.urlToUri(publicUrl))}`,
    value: replaceVersion(pageUri)
  });
}

/**
 * Publish a uri
 * @param {string} uri
 * @param {object} [data]
 * @param {object} [locals]
 * @returns {Promise}
 */
function publish(uri, data, locals) {
  const startTime = process.hrtime(),
    prefix = getPrefix(uri),
    site = getSite(prefix, locals),
    timeoutLimit = timeoutConstant * timeoutPublishCoefficient,
    user = locals && locals.user;
  var publishedMeta; // We need to store some meta a little later

  return getPublishData(uri, data)
    .then(publishService.resolvePublishUrl(uri, locals, site))
    .then(({ meta, data: pageData}) => {
      const published = 'published',
        dynamicPage = pageData._dynamic,
        componentList = references.getPageReferences(pageData);

      if (!references.isUrl(meta.url) && !dynamicPage) {
        throw new Error('Client: Page must have valid url to publish.');
      }

      return bluebird.map(componentList, getRecursivePublishedPutOperations(locals))
        .then(_.flatten) // only one level of flattening needed, because getPutOperations should have flattened its list already
        .then(ops => {
          // convert the data to all @published
          pageData = replacePageReferenceVersions(pageData, published);

          // Make public unless we're dealing with a `_dynamic` page
          if (!dynamicPage) {
            addOpToMakePublic(ops, prefix, meta.url, uri);
          }

          // Store the metadata if we're at this point
          publishedMeta = meta;

          // add page PUT operation last
          return addOp(replaceVersion(uri, published), pageData, ops);
        });
    })
    .then(applyBatch)
    .tap(() => {
      const ms = timer.getMillisecondsSince(startTime);

      if (ms > timeoutLimit * 0.5) {
        log('warn', `slow publish ${uri} ${ms}ms`);
      } else {
        log('info', `published ${replaceVersion(uri)} ${ms}ms`);
      }
    })
    .timeout(timeoutLimit, `Page publish exceeded ${timeoutLimit}ms: ${uri}`)
    .then(publishedData => {
      return meta.publishPage(uri, publishedMeta, user).then(() => {
        // Notify the bus
        bus.publish('publishPage', { uri, data: publishedData, user});

        notifications.notify(site, 'published', publishedData);
        // Update the meta object
        return publishedData;
      });
    });
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
    pageData = data && references.omitPageConfiguration(data),
    prefix = getPrefix(uri),
    pageReference = `${prefix}/_pages/${uid.get()}`,
    user = locals && locals.user;

  if (!layoutReference || !isLayout(layoutReference)) {
    throw new Error('Client: Data missing layout reference.');
  }

  return layouts.get(layoutReference, locals) // check to make sure the layout 200's
    .then(() => {
      return getPageClonePutOperations(pageData, locals)
        .then(ops => {
          pageData.layout = layoutReference;
          return addOp(pageReference, pageData, ops);
        });
    })
    .then(applyBatch)
    .then(newPage => {
      newPage._ref = pageReference;

      return meta.createPage(newPage._ref, user)
        .then(() => {
          bus.publish('createPage', { uri: pageReference, data: newPage, user });

          return newPage;
        });
    });
}

/**
 * handle page PUTs (that aren't to @published)
 * checks to see if a page exists (to trigger `createPage` plugin hook),
 * then passes the data to the db
 * @param  {string} uri
 * @param  {object} data
 * @param {object} locals
 * @returns {Promise}
 */
function putLatest(uri, data, locals) {
  const user = locals && locals.user;

  // check the page for a proper layout
  if (!data.layout || !isLayout(data.layout)) {
    throw Error('Page must contain a `layout` property whose value is a `_layouts` instance');
  }

  // continue saving the page normally
  return db.getLatestData(uri)
    .then(() => db.put(uri, JSON.stringify(data)).then(() => data)) // data already exist
    .catch(() => {
      return db.put(uri, JSON.stringify(data))
        .then(() => meta.createPage(uri, user))
        .then(() => {
          bus.publish('createPage', { uri, data, user });

          return data;
        });
    });
}

module.exports.create = create;
module.exports.publish = publish;
module.exports.putLatest = putLatest;
module.exports.replacePageReferenceVersions = replacePageReferenceVersions;

// For testing
module.exports.setTimeoutConstant = val => timeoutConstant = val;
module.exports.getTimeoutConstant = () => timeoutConstant;
module.exports.setLog = mock => log = mock;
module.exports.setDb = mock => db = mock;
