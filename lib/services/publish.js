'use strict';

/**
 * This file is used for resolving the url to publish
 * an page as well as storing the URL history for
 * the page.
 */
const _ = require('lodash'),
  bluebird = require('bluebird'),
  { parse } = require('url'),
  buf = require('./buffer'),
  meta = require('./metadata'),
  { getPrefix, replaceVersion } = require('clayutils');
var db = require('./db'),
  log = require('./logger').setup({ file: __filename, action: 'pagePublish' });

/**
 * grab any old urls from the published page (if it exist) and save them in the current page
 * note: we're modifying data in place (but returning the url history)
 *
 * @param {Object} metaObj
 * @param {String} uri
 * @param {String} url
 * @returns {Promise}
 */
function storeUrlHistory(metaObj, uri, url) {
  // get the published page (if it exists) and update the urlHistory array
  return meta.getMeta(uri)
    .then(metaData => {
      metaObj.urlHistory = metaData.urlHistory || [];

      if (_.last(metaData.urlHistory) !== url) {
        // only add urls if they've changed
        // note: this checks the last url, so you can revert urls you don't like, e.g.
        // originally published with: domain.com/foo.html
        // re-published with: domain.com/bar.html
        // reverted (re-published again) with: domain.com/foo.html
        metaObj.urlHistory.push(url);
      }
      return metaObj; // always return url history
    });
}

/**
 * add a 301 redirect to the previous uri
 * note: we only need to add it to the previous one, because ones before will point
 * to it, e.g. /one.html → /two.html → /three.html
 * multiple 301s on the same server have no performance penalties
 *
 * @param {Object} metaObj
 * @param {string} uri
 * @returns {Promise|undefined}
 */
function addRedirects(metaObj, uri) {
  const { urlHistory } = metaObj;

  if (urlHistory.length > 1) {
    // there are old urls! redirect the previous url to latest url
    let prevUrl = parse(urlHistory[urlHistory.length - 2]),
      prevUri = `${prevUrl.hostname}${prevUrl.pathname}`,
      newUrl = parse(_.last(urlHistory)),
      newUri = `${newUrl.hostname}${newUrl.pathname}`,
      prefix = getPrefix(uri);

    // update the previous uri to point to the latest uri
    return db.put(`${prefix}/_uris/${buf.encode(prevUri)}`, `${prefix}/_uris/${buf.encode(newUri)}`)
      .then(() => metaObj);
  }

  return metaObj;
}

/**
 * Return the url for a page based on own url. This occurs when a page
 * falls outside of all publishing rules supplied by the implementation
 * BUT there is a `url` property already set on the page data.
 *
 * @param {String} uri
 * @param {Object} pageData
 * @param {String} pageData.url
 * @param {String} pageData.customUrl
 * @returns {Promise}
 */
function _checkForUrlProperty(uri, { url, customUrl }) {
  if (!url && !customUrl) {
    return bluebird.reject(new Error('Page does not have a `url` or `customUrl` property set'));
  }

  return bluebird.resolve(url || customUrl);
}

/**
 * Allow a page to be published if it is dynamic. This allows the page
 * to be published, but the pages service has the logic to not create
 * a _uri to point to the page
 *
 * @param  {String} uri
 * @param  {Boolean|Undefined} _dynamic
 * @return {Promise}
 */
function _checkForDynamicPage(uri, { _dynamic }) {
  if (!_dynamic || typeof _dynamic !== 'boolean') {
    return bluebird.reject(new Error('Page is not dynamic and requires a url'));
  }

  return bluebird.resolve(_dynamic);
}

/**
 * Checks the archive property on a page's meta object, to determine whether
 * it can be published. Archived pages should not be published. Otherwise, an
 * initial object is passed to the processing chain in processPublishRules.
 *
 * @param {String} uri
 * @returns {Promise}
 */
function _checkForArchived(uri) {
  return db.getMeta(replaceVersion(uri))
    .then(meta => meta.archived)
    .then(archived => archived
      ? bluebird.reject({ val: '', errors: { _checkForArchived: 'The page is archived and cannot be published' } })
      : bluebird.resolve({ val: '', errors: {} })
    );
}

/**
 * Allow functions to add data to the meta object.
 * Functions are defined on the site controller and
 * can be synchronous or async.
 *
 * @param {Object} meta
 * @param {Array} modifiers
 * @param {String} uri
 * @param {Object} data
 * @returns {Promise}
 */
function addToMeta(meta, modifiers = [], uri, data) {
  if (!modifiers.length) return meta;

  return bluebird.reduce(modifiers, (acc, modify) => {
    return bluebird.try(modify.bind(null, uri, data, acc))
      .then(resp => Object.assign(acc, resp));
  }, {}).then(acc => Object.assign(acc, meta));
}

/**
 * Always do these actions when publishing a page
 *
 * @param {String} url
 * @param {String} uri
 * @param {Object} data
 * @param {Object} locals
 * @param {Object} site
 * @return {Promise}
 */
function publishPageAtUrl(url, uri, data, locals, site) { // eslint-disable-line
  if (data._dynamic) {
    locals.isDynamicPublishUrl = true;
    return data;
  }

  // set the publishUrl for component's model.js files that
  // may want to know about the URL of the page
  locals.publishUrl = url;

  return bluebird.resolve({ url })
    .then(metaObj => storeUrlHistory(metaObj, uri, url))
    .then(metaObj => addRedirects(metaObj, uri))
    .then(metaObj => addToMeta(metaObj, site.assignToMetaOnPublish, uri, data));
}

/**
 * Reduce through the publishing rules supplied
 * by the site and aggregate the error messages
 * until a valid url is retrieved. Once retrieved,
 * skip the rest of the rules quickly and return
 * the result.
 *
 * @param {Array} publishingChain
 * @param {String} uri
 * @param {Object} pageData
 * @param {Object} locals
 * @returns {Promise}
*/
function processPublishRules(publishingChain, uri, pageData, locals) {

  // check whether page is archived, then run the rest of the publishing chain
  return _checkForArchived(uri)
    .then(initialObj => {
      return bluebird.reduce(publishingChain, (acc, fn, index) => {
        if (!acc.val) {
          return bluebird.try(() => fn(uri, pageData, locals))
            .then(val => {
              acc.val = val;
              return acc;
            })
            .catch(e => {
              acc.errors[fn.name || index] = e.message;
              return bluebird.resolve(acc);
            });
        }
        return acc;
      }, initialObj);
    })
    .catch(err => bluebird.resolve(err)); // err object constructed in _checkForArchived function above
}

/**
 * Given the response from the processing of the
 * publish rules, determine if we need to log errors
 * or if we're good to proceed.
 *
 * @param {String} uri
 * @param {String} val
 * @param {Object} errors
 * @returns {String|Promise<Error>}
 */
function validatePublishRules(uri, { val, errors }) {
  let err, errMsg;

  if (!val) {
    errMsg = `Error publishing page: ${replaceVersion(uri)}`;
    log('error', errMsg, { publishRuleErrors: errors });
    err = new Error(errMsg);
    err.status = 400;
    return bluebird.reject(err);
  }

  return val;
}

function resolvePublishUrl(uri, locals, site) {
  return pageData => {
    /**
     * The publishing chain is an array of functions which either return a function to publish a page
     * or throw an error.  This is a variant of the Chain of Responsibility pattern, which we're calling Reject Quickly/Resolve Slowly.
     * Functions should reject quickly if the data doesn't match the format they want, and afterwards resolve the generated url if the data does match.
     * The function that resolves is expected to add a `url` property to pageData and return pageData or a promise that resolves to pageData
     */
    var publishingChain = [_checkForUrlProperty, _checkForDynamicPage];

    if (site.resolvePublishUrl && Array.isArray(site.resolvePublishUrl)) {
      publishingChain = publishingChain.concat(site.resolvePublishUrl);
    }

    // Iterate over an array of publishing functions sequentially to find the first one which resolves
    // return chain(publishingChain, uri, _.cloneDeep(pageData), locals)
    return processPublishRules(publishingChain, uri, _.cloneDeep(pageData), locals)
      .then(resp => validatePublishRules(uri, resp))
      .then(url => publishPageAtUrl(url, uri, pageData, locals, site))
      .then(meta => ({ meta, data: pageData }));
  };
}

module.exports.resolvePublishUrl = resolvePublishUrl;

// For testing
module.exports._checkForUrlProperty = _checkForUrlProperty;
module.exports._checkForDynamicPage = _checkForDynamicPage;
module.exports._checkForArchived = _checkForArchived;
module.exports.processPublishRules = processPublishRules;
module.exports.validatePublishRules = validatePublishRules;
module.exports.addToMeta = addToMeta;
module.exports.setLog = mock => log = mock;
module.exports.setDb = mock => db = mock;
