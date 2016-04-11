'use strict';

const _ = require('lodash'),
  bluebird = require('bluebird'),
  components = require('../../../lib/services/components'),
  db = require('../../../lib/services/db'),
  endpointName = _.startCase(__dirname.split('/').pop()),
  express = require('express'),
  filename = _.startCase(__filename.split('/').pop().split('.').shift()),
  files = require('../../../lib/files'),
  hostname = 'some-hostname',
  winston = require('winston'),
  multiplexTemplates = require('multiplex-templates'),
  sinon = require('sinon'),
  routes = require('../../../lib/routes'),
  request = require('supertest-as-promised');

/**
 * @param {string} publicUri
 * @param {string} pageId
 * @returns {function}
 */
function addUri(publicUri, pageId) {
  return function () {
    return db.put(hostname + '/uris/' + new Buffer(publicUri).toString('base64'), hostname + '/pages/' + pageId);
  };
}

/**
 * @param {string} id
 * @param {object} data
 * @returns {function}
 */
function addPage(id, data) {
  return function () {
    return db.put(hostname + '/pages/' + id, JSON.stringify(data));
  };
}

function requestSitemap(app) {
  return request(app)
    .get('/sitemap.xml')
    .set('Host', hostname)
    .expect(200)
    .expect('Content-Type', /xml/);
}

describe(endpointName, function () {
  describe(filename, function () {
    let sandbox, app, header, footer;

    beforeEach(function () {
      sandbox = sinon.sandbox.create();
      sandbox.stub(components, 'get');
      sandbox.stub(components, 'getTemplate');
      sandbox.stub(files, 'fileExists');
      sandbox.stub(multiplexTemplates, 'render');
      sandbox.stub(winston);

      header = '<?xml version="1.0" encoding="UTF-8"?>' +
        '<urlset xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" ' +
        'xsi:schemaLocation="http://www.sitemaps.org/schemas/sitemap/0.9 http://www.sitemaps.org/schemas/sitemap/0.9/sitemap.xsd" ' +
        'xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" ' +
        'xmlns:image="http://www.google.com/schemas/sitemap-image/1.1" ' +
        'xmlns:video="http://www.google.com/schemas/sitemap-video/1.1">';
      footer = '</urlset>';

      files.fileExists.withArgs('public').returns(true);

      app = express();
      routes.addHost(app, hostname);

      return db.clear()
        // a should not show because no url in page
        .then(addPage('a', {}))
        .then(addUri('some-url/a', 'a'))
        // b should not show because no public uri
        .then(addPage('b', {url: 'http://some-url/b'}))
        // c should not show because not published
        .then(addPage('c', {url: 'http://some-url/c'}))
        .then(addUri('some-url/c', 'c'))
        // d should show (has published, but no latest)
        .then(addPage('d@published', {url: 'http://some-url/d'}))
        .then(addUri('some-url/d', 'd'))
        // e should show (has published and latest)
        .then(addPage('e', {url: 'http://some-url/e'}))
        .then(addPage('e@published', {url: 'http://some-url/e'}))
        .then(addUri('some-url/e', 'e'));
    });

    afterEach(function () {
      sandbox.restore();
    });

    after(function () {
      return db.clear();
    });

    it('gets sitemap', function () {
      return request(app)
        .get('/sitemap.xml')
        .set('Host', hostname)
        .expect(header +
          '<url><loc>http://some-url/d</loc></url>' +
          '<url><loc>http://some-url/e</loc></url>' +
          footer)
        .then(function () {
          sinon.assert.notCalled(winston.log);
        });
    });

    it('get sitemap with lastModified as timestamp', function () {
      return bluebird.resolve()
        .then(addUri('some-url/f', 'f'))
        .then(addPage('f@published', {url: 'http://some-url/f', lastModified: new Date('2015-01-01').getTime()}))
        .then(function () {
          return requestSitemap(app).expect(header +
            '<url><loc>http://some-url/d</loc></url>' +
            '<url><loc>http://some-url/e</loc></url>' +
            '<url><loc>http://some-url/f</loc><lastmod>2015-01-01T00:00:00.000Z</lastmod></url>' +
            footer);
        }).then(function () {
          sinon.assert.notCalled(winston.log);
        });
    });

    it('get sitemap with lastModified as string', function () {
      return bluebird.resolve()
        .then(addUri('some-url/f', 'f'))
        .then(addPage('f@published', {url: 'http://some-url/f', lastModified: 'some time string'}))
        .then(function () {
          return requestSitemap(app).expect(header +
            '<url><loc>http://some-url/d</loc></url>' +
            '<url><loc>http://some-url/e</loc></url>' +
            '<url><loc>http://some-url/f</loc><lastmod>some time string</lastmod></url>' +
            footer);
        }).then(function () {
          sinon.assert.notCalled(winston.log);
        });
    });

    it('get sitemap with priority as string', function () {
      return bluebird.resolve()
        .then(addUri('some-url/f', 'f'))
        .then(addPage('f@published', {url: 'http://some-url/f', priority: '1.0'}))
        .then(function () {
          return requestSitemap(app).expect(header +
            '<url><loc>http://some-url/d</loc></url>' +
            '<url><loc>http://some-url/e</loc></url>' +
            '<url><loc>http://some-url/f</loc><priority>1.0</priority></url>' +
            footer);
        }).then(function () {
          sinon.assert.notCalled(winston.log);
        });
    });

    it('get sitemap with change frequency', function () {
      return bluebird.resolve()
        .then(addUri('some-url/f', 'f'))
        .then(addPage('f@published', {url: 'http://some-url/f', changeFrequency: 'never'}))
        .then(function () {
          return requestSitemap(app).expect(header +
            '<url><loc>http://some-url/d</loc></url>' +
            '<url><loc>http://some-url/e</loc></url>' +
            '<url><loc>http://some-url/f</loc><changefreq>never</changefreq></url>' +
            footer);
        }).then(function () {
          sinon.assert.notCalled(winston.log);
        });
    });

    it('warns when given bad json, does not include page', function () {
      return db.put(hostname + '/pages/x@published', '{what?').then(function () {
        function expectLog() {
          sinon.assert.calledWith(winston.log, 'warn');
        }

        return request(app)
          .get('/sitemap.xml')
          .set('Host', hostname)
          .expect(200)
          .expect('Content-Type', /xml/)
          .expect(header +
            '<url><loc>http://some-url/d</loc></url>' +
            '<url><loc>http://some-url/e</loc></url>' +
            footer)
          .then(expectLog);
      });
    });

    it('warns when uri does not point to page, does not include page', function () {
      return bluebird.resolve()
        .then(addUri('some-url/f', 'd'))
        .then(addPage('f@published', {url: 'http://some-url/f'}))
        .then(function () {
          return requestSitemap(app).expect(header +
            '<url><loc>http://some-url/d</loc></url>' +
            '<url><loc>http://some-url/e</loc></url>' +
            footer);
        }).then(function () {
          sinon.assert.calledWith(winston.log, 'warn');
        });
    });

    it('get sitemap with component template', function () {
      const componentReference = hostname + '/components/k',
        componentData = {a: 'b'};

      components.get.withArgs(componentReference).returns(bluebird.resolve(componentData));
      components.getTemplate.returns('abc');
      multiplexTemplates.render.returns('<def></def>');

      return bluebird.resolve()
        .then(addUri('some-url/f', 'f'))
        .then(addPage('f@published', {url: 'http://some-url/f', area: componentReference}))
        .then(function () {
          return requestSitemap(app).expect(header +
            '<url><loc>http://some-url/d</loc></url>' +
            '<url><loc>http://some-url/e</loc></url>' +
            '<url><loc>http://some-url/f</loc><def></def></url>' +
            footer);
        }).then(function () {
          sinon.assert.notCalled(winston.log);
        });
    });

    it('warns when render fails, but includes page without extras', function () {
      const componentReference = hostname + '/components/k',
        componentData = {a: 'b'};

      components.get.withArgs(componentReference).returns(bluebird.resolve(componentData));
      components.getTemplate.returns('abc');
      multiplexTemplates.render.throws();

      return bluebird.resolve()
        .then(addUri('some-url/f', 'f'))
        .then(addPage('f@published', {url: 'http://some-url/f', area: componentReference}))
        .then(function () {
          return requestSitemap(app).expect(header +
            '<url><loc>http://some-url/d</loc></url>' +
            '<url><loc>http://some-url/e</loc></url>' +
            '<url><loc>http://some-url/f</loc></url>' +
            footer);
        }).then(function () {
          sinon.assert.calledWith(winston.log, 'warn');
        });
    });

    it('gets sitemap without extras if component does not have template', function () {
      const componentReference = hostname + '/components/k',
        componentData = {a: 'b'};

      components.get.withArgs(componentReference).returns(bluebird.resolve(componentData));
      components.getTemplate.returns(undefined);

      return bluebird.resolve()
        .then(addUri('some-url/f', 'f'))
        .then(addPage('f@published', {url: 'http://some-url/f', area: componentReference}))
        .then(function () {
          return requestSitemap(app).expect(header +
            '<url><loc>http://some-url/d</loc></url>' +
            '<url><loc>http://some-url/e</loc></url>' +
            '<url><loc>http://some-url/f</loc></url>' +
            footer);
        }).then(function () {
          sinon.assert.notCalled(winston.log);
        });
    });

    it('warns when component is not found', function () {
      const componentReference = hostname + '/components/k',
        error = new Error();

      error.name = 'NotFoundError';

      // note that if this page were to be rendered normally (in html) it will 404, so don't include in sitemap
      components.get.throws(error);

      return bluebird.resolve()
        .then(addUri('some-url/f', 'f'))
        .then(addPage('f@published', {url: 'http://some-url/f', area: componentReference}))
        .then(function () {
          return requestSitemap(app).expect(header +
            '<url><loc>http://some-url/d</loc></url>' +
            '<url><loc>http://some-url/e</loc></url>' +
            footer);
        }).then(function () {
          sinon.assert.calledWith(winston.log, 'warn');
        });
    });
  });
});
