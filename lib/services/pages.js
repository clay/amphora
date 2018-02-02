'use strict';

var timeoutConstant = 4000,
  log = require('./logger').setup({
    file: __filename
  });
const _ = require('lodash'),
  buf = require('./buffer'),
  bluebird = require('bluebird'),
  components = require('./components'),
  composer = require('./composer'),
  db = require('./db'),
  notifications = require('./notifications'),
  references = require('./references'),
  siteService = require('./sites'),
  timer = require('../timer'),
  uid = require('../uid'),
  { getComponentName } = require('clayutils'),
  publishService = require('./publish'),
  plugins = require('../plugins'),
  timeoutPublishCoefficient = 5;

/**
 * @param {number} value
 */
function setTimeoutConstant(value) {
  timeoutConstant = value;
}

/**
 * @returns {number}
 */
function getTimeoutConstant() {
  return timeoutConstant;
}

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
  return bluebird.all(_.reduce(pageData, function (promises, pageValue, pageKey) {
    if (typeof pageValue === 'string' && getComponentName(pageValue)) {
      // for all strings that are component references
      promises.push(components.get(pageValue, locals).then(function (refData) {
        // only follow the paths of instance references.  Don't clone default components
        return composer.resolveComponentReferences(refData, locals, isInstanceReferenceObject);
      }).then(function (resolvedData) {
        // for each instance reference within resolved data
        _.each(references.listDeepObjects(resolvedData, isInstanceReferenceObject), function (obj) {
          obj._ref = renameReferenceUniquely(obj._ref);
        });

        // rename reference in pageData
        const ref = renameReferenceUniquely(pageValue);

        pageData[pageKey] = ref;

        // put new data using cascading PUT at place that page now points
        return components.getPutOperations(ref, resolvedData, locals);
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
 * @param {object} site
 * @returns {Promise}
 */
function applyBatch(site) {
  return function (ops) {
    const lastOp = _.last(ops),
      lastValue = lastOp && JSON.parse(lastOp.value);

    return db.batch(ops).then(function () {
      // if published, notify listeners
      if (_.endsWith(lastOp.key, '@published')) {
        notifications.notify(site, 'published', lastValue).catch(function (error) {
          log('warn', `notification error: ${error.message}`);
        });
      }
    }).return(lastValue);
  };
}

/**
 * Replace the referenced things in the page data with a different version
 * @param {object} data
 * @param {string} version
 * @returns {object}
 */
function replacePageReferenceVersions(data, version) {
  const replaceVersion = _.partial(references.replaceVersion, _, version);

  return _.mapValues(data, function (value, key) {
    let result;

    if (references.isUri(value)) {
      result = replaceVersion(value);
    } else if (_.isArray(value) && key !== 'urlHistory') {
      // urlHistory is an array of old page urls. they're not component refs and shouldn't be versioned
      result = _.map(value, replaceVersion);
    } else {
      result = value;
    }
    return result;
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
 * @param {object} locals
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
      .then(data => composer.resolveComponentReferences(data, locals))
      .then(data => components.getPutOperations(references.replaceVersion(rootComponentRef, published), data, locals));
  };
}

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
  return bluebird.try(function () {
    if (data && _.size(data) > 0) {
      // if they actually gave us something, use it
      assertNoEmptyValues(data);
      return data;
    }
    // otherwise, assume they meant whatever is in @latest
    return getLatestData(uri);
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
    value: references.replaceVersion(pageUri)
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
    prefix = references.getPagePrefix(uri),
    site = getSite(prefix, locals),
    timeoutLimit = timeoutConstant * timeoutPublishCoefficient;


  return getPublishData(uri, data)
    .then(publishService(uri, locals, site))
    .then(function (pageData) {
      const published = 'published',
        publicUrl = pageData.customUrl || pageData.url,
        componentList = references.getPageReferences(pageData);

      if (!references.isUrl(publicUrl)) {
        throw new Error('Client: Page must have valid url to publish.');
      }

      return bluebird.map(componentList, getRecursivePublishedPutOperations(locals))
        .then(_.flatten) // only one level of flattening needed, because getPutOperations should have flattened its list already
        .then(function (ops) {
          // convert the data to all @published
          pageData = replacePageReferenceVersions(pageData, published);

          // make public
          addOpToMakePublic(ops, prefix, publicUrl, uri);

          // add page PUT operation last
          return addOp(references.replaceVersion(uri, published), pageData, ops);
        });
    }).then(applyBatch(site)).tap(function () {
      const ms = timer.getMillisecondsSince(startTime);

      if (ms > timeoutLimit * 0.5) {
        log('warn', `slow publish ${uri} ${ms}ms`);
      } else {
        log('info', `published ${references.replaceVersion(uri)} ${ms}ms`);
      }
    }).timeout(timeoutLimit, `Page publish exceeded ${timeoutLimit}ms: ${uri}`)
    .then(function (publishedData) {
      plugins.executeHook('publishPage', { uri: uri, data: publishedData, user: locals && locals.user });
      return publishedData;
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
    prefix = uri.substr(0, uri.indexOf('/_pages')),
    site = getSite(prefix, locals),
    pageReference = `${prefix}/_pages/${uid.get()}`;

  if (!layoutReference) {
    throw new Error('Client: Data missing layout reference.');
  }

  return components.get(layoutReference, locals).then(function () {

    return getPageClonePutOperations(pageData, locals).then(function (ops) {
      pageData.layout = layoutReference;

      return addOp(pageReference, pageData, ops);
    });
  }).then(applyBatch(site)).then(function (newPage) {
    plugins.executeHook('createPage', { uri: pageReference, data: newPage, user: locals && locals.user });
    // if successful, return new page object, but include the (optional) self reference to the new page.
    newPage._ref = pageReference;

    return newPage;
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
  return getLatestData(uri)
    .then(() => db.put(uri, JSON.stringify(data)).return(data)) // data already exists
    .catch(() => db.put(uri, JSON.stringify(data)).then(() => plugins.executeHook('createPage', { uri, data, user: locals && locals.user })).return(data));
}

module.exports.create = create;
module.exports.publish = publish;
module.exports.putLatest = putLatest;
module.exports.replacePageReferenceVersions = replacePageReferenceVersions;

module.exports.getTimeoutConstant = getTimeoutConstant;
module.exports.setTimeoutConstant = setTimeoutConstant;

// For testing
module.exports.setLog = function (fakeLogger) {
  log = fakeLogger;
};
