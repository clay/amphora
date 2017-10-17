'use strict';

/**
 * This file is used for resolving the url to publish
 * an page as well as storing the URL history for
 * the page.
 */
var log = require('./logger').setup({
  file: __filename,
  action: 'publish'
});
const _ = require('lodash'),
  bluebird = require('bluebird'),
  { parse } = require('url'),
  db = require('./db'),
  buf = require('./buffer'),
  chain = require('chain-of-promises'),
  references = require('./references');

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
    .catch(function (e) {
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
      prefix = references.getPagePrefix(uri);

    // update the previous uri to point to the latest uri
    return db.put(`${prefix}/uris/${buf.encode(prevUri)}`, `${prefix}/uris/${buf.encode(newUri)}`);
  }
}

/**
 * Return the url for a page based on own url. This occurs when a page
 * falls outside of all publishing rules supplied by the implementation
 * BUT there is a `url` property already set on the page data.
 *
 * @param {Object} pageData
 * @returns {Promise}
 */
function getPassthroughPageUrl(uri, { url, customUrl }) {
  if (!url && !customUrl) {
    return bluebird.reject(new Error('All pages need a url or customUrl to publish'));
  }

  return bluebird.resolve(customUrl || url);
}


/**
 * Always do these actins when publishing a page
 *
 * @param {String} url
 * @param {String} uri
 * @param {Object} data
 * @param {Object} locals
 * @param {Object} sites
 * @return {Promise}
 */
function publishPageAtUrl(url, uri, data, locals, site) {
  // So a url can still be derived from rules unique to the
  // implementation, but customUrl should override those rules
  url = data.customUrl || url;

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
    return bluebird.try(val.bind(null, acc))
  }, data);
}

function resolvePublishUrl(uri, locals, site) {
  return function(pageData) {
    /**
     * The publishing chain is an array of functions which either return a function to publish a page
     * or throw an error.  This is a variant of the Chain of Responsibility pattern, which we're calling Reject Quickly/Resolve Slowly.
     * Functions should reject quickly if the data doesn't match the format they want, and afterwards resolve the generated url if the data does match.
     * The function that resolves is expected to add a `url` property to pageData and return pageData or a promise that resolves to pageData
     */
    var publishingChain = [],
      useResolvePublishUrl = _.isArray(site.resolvePublishUrl), // We want to allow for the old API until Amphora 5.x
      useResolvePublishing = _.isFunction(site.resolvePublishing);

    if (useResolvePublishing) {
      // Warn about deprecation
      log('warn', 'Site specific `resolvePublishing` service will be deprecated in Amphora 5, switch to new `resolvePublishUrl` API');
    }

    if (useResolvePublishUrl || useResolvePublishing) {
      // Allow a site to add or modify the publishing chain
      publishingChain = useResolvePublishUrl ? publishingChain.concat(site.resolvePublishUrl) : site.resolvePublishing(publishingChain, locals); // Run through the old API
      publishingChain.push(getPassthroughPageUrl); // We always want to make sure we get a page url
    }

    if ( publishingChain.length > 0 ) {
      // Iterate over an array of publishing functions sequentially to find the first one which resolves
      return chain(publishingChain, uri, _.cloneDeep(pageData), locals)
        .then(function (urlOrPageData) {
          return useResolvePublishUrl ? publishPageAtUrl(urlOrPageData, uri, pageData, locals, site) : urlOrPageData;
        })
        .catch(e => {
          throw e;
        });
    }

    return bluebird.resolve(pageData);
  }
}

module.exports = resolvePublishUrl;


// For testing
module.exports.getPassthroughPageUrl = getPassthroughPageUrl;
module.exports.modifyPublishedData = modifyPublishedData;
module.exports.setLog = function (fakeLogger) {
  log = fakeLogger;
};
