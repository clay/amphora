'use strict';

/**
 * This file is used for resolving the url to publish
 * an page as well as storing the URL history for
 * the page.
 */
const _ = require('lodash'),
  bluebird = require('bluebird'),
  { parse } = require('url'),
  db = require('./db'),
  buf = require('./buffer'),
  { getPrefix, replaceVersion } = require('clayutils');
var log = require('./logger').setup({ file: __filename, action: 'pagePublish' });

/**
 * grab any old urls from the published page (if it exist) and save them in the current page
 * note: we're modifying data in place (but returning the url history)
 * @param {String} url
 * @param {String} uri
 * @param {Object} data
 * @returns {Promise}
 */
function storeUrlHistory(url, uri, data) {
  // get the published page (if it exists) and update the urlHistory array
  return db.get(uri)
    .then(JSON.parse)
    .catch(function () {
      // if this is the first time we're publishing, db.get() won't find
      // the published page data. thus, return empty object so we can add the urlHistory
      return {};
    })
    .then(function (publishedPageData) {
      data.urlHistory = publishedPageData.urlHistory || [];

      if (_.last(data.urlHistory) !== url) {
        // only add urls if they've changed
        // note: this checks the last url, so you can revert urls you don't like, e.g.
        // originally published with: domain.com/foo.html
        // re-published with: domain.com/bar.html
        // reverted (re-published again) with: domain.com/foo.html
        data.urlHistory.push(url);
      }
      return data.urlHistory; // always return url history
    });
}

/**
 * Given page data, locals and a generated url make
 * sure the new url is added to all the appropriate
 * places for saving published data
 *
 * @param {String} generatedUrl
 * @param {Object} page
 * @param {Object} locals
 * @returns {Promise}
 */
function updatePageAndLocalsWithUrl(generatedUrl, page, locals) {
  // Add the url property to the page. If this line is removed,
  // everything breaks (unless `customUrl` is being used). Trust me.
  page.url = generatedUrl;

  // set the publishUrl for component's model.js files that
  // may want to know about the URL of the page
  locals.publishUrl = generatedUrl;

  return bluebird.resolve(generatedUrl);
}

/**
 * add a 301 redirect to the previous uri
 * note: we only need to add it to the previous one, because ones before will point
 * to it, e.g. /one.html → /two.html → /three.html
 * multiple 301s on the same server have no performance penalties
 * @param {array} urlHistory
 * @param {string} uri
 * @returns {Promise|undefined}
 */
function addRedirects(urlHistory, uri) {
  if (urlHistory.length > 1) {
    // there are old urls! redirect the previous url to latest url
    let prevUrl = parse(urlHistory[urlHistory.length - 2]),
      prevUri = `${prevUrl.hostname}${prevUrl.pathname}`,
      newUrl = parse(_.last(urlHistory)),
      newUri = `${newUrl.hostname}${newUrl.pathname}`,
      prefix = getPrefix(uri);

    // update the previous uri to point to the latest uri
    return db.put(`${prefix}/_uris/${buf.encode(prevUri)}`, `${prefix}/_uris/${buf.encode(newUri)}`);
  }
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

  return bluebird.resolve(customUrl || url);
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
 * Always do these actins when publishing a page
 *
 * @param {String} url
 * @param {String} uri
 * @param {Object} data
 * @param {Object} locals
 * @param {Object} site
 * @return {Promise}
 */
function publishPageAtUrl(url, uri, data, locals, site) { // eslint-disable-line
  // So a url can still be derived from rules unique to the
  // implementation, but customUrl should override those rules
  url = data.customUrl || url;

  if (data._dynamic) {
    locals.isDynamicPublishUrl = true;
    return data;
  }

  return updatePageAndLocalsWithUrl(url, data, locals)
    .then(url => storeUrlHistory(url, uri, data))
    .then(urlHistory => addRedirects(urlHistory, uri))
    .then(() => modifyPublishedData(site, data));
}

/**
 * Allow site to append/change data on a published page before
 * publishing. Hooks are specified in the `modifyPublishedData`
 * Array in the site's index.js and should be an Array of
 * synchronous or asynchronous functions
 *
 * @param  {Array}  modifyPublishedData
 * @param  {Object} data
 * @return {Promise}
 */
function modifyPublishedData({ modifyPublishedData }, data) {
  if (!_.isArray(modifyPublishedData)) {
    return bluebird.resolve(data);
  }

  return bluebird.reduce(modifyPublishedData, function (acc, val) {
    return bluebird.try(val.bind(null, acc));
  }, data);
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
  }, { val: '', errors: {}});
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
    errMsg = `Unable to determine a url for publishing ${replaceVersion(uri)}`;
    log('error', errMsg, { publishRuleErrors: errors });
    err = new Error(errMsg);
    err.status = 400;
    return bluebird.reject(err);
  }

  return val;
}

function resolvePublishUrl(uri, locals, site) {
  return function (pageData) {
    /**
     * The publishing chain is an array of functions which either return a function to publish a page
     * or throw an error.  This is a variant of the Chain of Responsibility pattern, which we're calling Reject Quickly/Resolve Slowly.
     * Functions should reject quickly if the data doesn't match the format they want, and afterwards resolve the generated url if the data does match.
     * The function that resolves is expected to add a `url` property to pageData and return pageData or a promise that resolves to pageData
     */
    var publishingChain = [_checkForUrlProperty, _checkForDynamicPage];

    if (site.resolvePublishUrl && Array.isArray(site.resolvePublishUrl)) {
      publishingChain = site.resolvePublishUrl.concat(publishingChain);
    }

    // Iterate over an array of publishing functions sequentially to find the first one which resolves
    // return chain(publishingChain, uri, _.cloneDeep(pageData), locals)
    return processPublishRules(publishingChain, uri, _.cloneDeep(pageData), locals)
      .then(resp => validatePublishRules(uri, resp))
      .then(url => publishPageAtUrl(url, uri, pageData, locals, site));
  };
}

module.exports = resolvePublishUrl;

// For testing
module.exports._checkForUrlProperty = _checkForUrlProperty;
module.exports._checkForDynamicPage = _checkForDynamicPage;
module.exports.modifyPublishedData = modifyPublishedData;
module.exports.processPublishRules = processPublishRules;
module.exports.validatePublishRules = validatePublishRules;
module.exports.setLog = mock => log = mock;
