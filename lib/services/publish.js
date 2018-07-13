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
  chain = require('chain-of-promises'),
  meta = require('./metadata'),
  { getPrefix } = require('clayutils');
var db = require('./db');

/**
 * grab any old urls from the published page (if it exist) and save them in the current page
 * note: we're modifying data in place (but returning the url history)
 * @param {String} url
 * @param {String} uri
 * @param {Object} data
 * @returns {Promise}
 */
function storeUrlHistory(metaObj, uri, url) {
  // get the published page (if it exists) and update the urlHistory array
  return meta.getMeta(uri)
    // .catch(function () {
    //   // if this is the first time we're publishing, db.get() won't find
    //   // the published page data. thus, return empty object so we can add the urlHistory
    //   return {};
    // })
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
 * Given page data, locals and a generated url make
 * sure the new url is added to all the appropriate
 * places for saving published data
 *
 * @param {String} generatedUrl
 * @param {Object} page
 * @param {Object} locals
 * @returns {Promise}
 */
function updatePageAndLocalsWithUrl(generatedUrl, locals) {
  // // Add the url property to the page. If this line is removed,
  // // everything breaks (unless `customUrl` is being used). Trust me.
  // page.url = generatedUrl;

  // set the publishUrl for component's model.js files that
  // may want to know about the URL of the page
  locals.publishUrl = generatedUrl;

  return bluebird.resolve({
    url: generatedUrl
  });
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
function getPassthroughPageUrl(uri, { url, customUrl }) {
  if (!url && !customUrl) {
    return bluebird.reject(new Error('All pages need a url or customUrl to publish'));
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
function publishDynamicPage(uri, { _dynamic }) {
  if (!_dynamic || typeof _dynamic !== 'boolean') {
    return bluebird.reject(new Error('Page is not dynamic'));
  }

  return bluebird.resolve(_dynamic);
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

  return updatePageAndLocalsWithUrl(url, locals)
    .then(metaObj => storeUrlHistory(metaObj, uri, url))
    .then(metaObj => addRedirects(metaObj, uri))
    .then(metaObj => addToMeta(metaObj, site.assignToMetaOnPublish, uri, data));
}

function resolvePublishUrl(uri, locals, site) {
  return pageData => {
    /**
     * The publishing chain is an array of functions which either return a function to publish a page
     * or throw an error.  This is a variant of the Chain of Responsibility pattern, which we're calling Reject Quickly/Resolve Slowly.
     * Functions should reject quickly if the data doesn't match the format they want, and afterwards resolve the generated url if the data does match.
     * The function that resolves is expected to add a `url` property to pageData and return pageData or a promise that resolves to pageData
     */
    var publishingChain = [],
      useResolvePublishUrl = _.isArray(site.resolvePublishUrl);

    if (useResolvePublishUrl) {
      // Allow a site to add or modify the publishing chain
      publishingChain = publishingChain.concat(site.resolvePublishUrl, [getPassthroughPageUrl, publishDynamicPage]);
    }

    if ( publishingChain.length > 0 ) {
      // Iterate over an array of publishing functions sequentially to find the first one which resolves
      return chain(publishingChain, uri, _.cloneDeep(pageData), locals)
        .then(url => publishPageAtUrl(url, uri, pageData, locals, site))
        .then(meta => ({ meta, data: pageData }));
    }

    return bluebird.resolve(pageData);
  };
}

module.exports.resolvePublishUrl = resolvePublishUrl;

// For testing
module.exports.getPassthroughPageUrl = getPassthroughPageUrl;
module.exports.publishDynamicPage = publishDynamicPage;
module.exports.setDb = mock => db = mock;
