'use strict';

const _ = require('lodash'),
  db = require('./services/db'),
  responses = require('./responses'),
  publishedFilter = require('./streams/published-filter'),
  sitemapTextTransform = require('./streams/sitemap-text-transform'),
  sitemapXmlTransform = require('./streams/sitemap-xml-transform');

/**
 * @param router
 */
function routes(router) {
  router.get('/sitemap.json', function (req, res) {
    responses.expectJSON(function () {
      return getCanonicalUrlListForSite(res.locals.site);
    }, res);
  });

  router.get('/sitemap.txt', function (req, res) {
    res.type('text');
    db.list({
      prefix: res.locals.site.prefix + '/pages/',
      keys: true,
      values: true,
      isArray: true,
      limit: 50000,
      json: false
    }).pipe(publishedFilter())
      .pipe(sitemapTextTransform())
      .pipe(res);
  });

  router.get('/sitemap.xml', function (req, res) {
    res.type('xml');
    db.list({
      prefix: res.locals.site.prefix + '/pages/',
      keys: true,
      values: true,
      isArray: true,
      limit: 50000,
      json: false
    }).pipe(publishedFilter())
      .pipe(sitemapXmlTransform())
      .pipe(res);
  });
}

module.exports.routes = routes;