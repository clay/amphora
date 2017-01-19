'use strict';

const _ = require('lodash'),
  expect = require('chai').expect,
  filename = __filename.split('/').pop().split('.').shift(),
  lib = require('./' + filename),
  sinon = require('sinon'),
  search = require('./search'),
  sites = require('./sites'),
  path = require('path'),
  responses = require('../responses'),
  sampleMapping = {
    component: {
      general: {
        dynamic: 'strict',
        properties: {
          property: {
            type: 'string',
            index: 'not_analyzed'
          }
        }
      }
    }
  },
  sampleBatchOp = [{
    type: 'put',
    key: '//localhost:3001/path/components/component/instances/foo',
    value: '{"value":"bar"}'
  }],
  publishedAndScheduledSampleBatch = [{
    type: 'put',
    key: '//localhost:3001/path/components/component/instances/foo@scheduled',
    value: '{"value":"bar","at": "1483207140000"}'
  }, {
    type: 'put',
    key: '//localhost:3001/path/components/component/instances/foo@published',
    value: '{"value":"bar","url":"http://someurl.com/"}'
  }];



describe(_.startCase(filename), function () {
  let sandbox;

  beforeEach(function () {
    sandbox = sinon.sandbox.create();
    sandbox.stub(search);
    sandbox.stub(sites);
    sandbox.stub(responses);
  });

  afterEach(function () {
    sandbox.restore();
  });

  describe('updatePageList', function () {
    const fn = lib[this.title],
      callback = fn(sampleMapping);

    it('returns a function', function () {
      expect(fn()).to.be.a('function');
    });

    it('when the callback is invoked, it creates a new page in the index if none exists', function () {
      // Stubs
      sandbox.stub(lib, 'pageExists').returns(Promise.resolve([false]));
      search.applyOpFilters.returns(Promise.resolve([
        [{
          ops: sampleBatchOp,
          mapping: sampleMapping,
          type: 'general'
        }]
      ]));
      search.batch.returns(Promise.resolve());
      sites.getSite.returns({ host: 'someSite', path: '/somePath' });

      return callback(sampleBatchOp)
        .then(function () {
          expect(search.batch.calledOnce).to.be.true;
        });
    });

    it('when the callback is invoked, it creates a new page in the index if none exists and handles scheduled or published ops', function () {
      // Stubs
      sandbox.stub(lib, 'pageExists').returns(Promise.resolve([false]));
      search.applyOpFilters.returns(Promise.resolve([
        [{
          ops: publishedAndScheduledSampleBatch,
          mapping: sampleMapping,
          type: 'general'
        }]
      ]));
      search.batch.returns(Promise.resolve());
      sites.getSite.returns({ host: 'someSite', path: '/somePath' });

      return callback(publishedAndScheduledSampleBatch)
        .then(function () {
          expect(search.batch.calledOnce).to.be.true;
        });
    });


    it('when the callback is invoked, if no ops are returned then it does not check if the continue', function () {
      // Stubs
      sandbox.stub(lib, 'pageExists');
      search.applyOpFilters.returns(Promise.resolve([
        [{
          ops: [],
          mapping: sampleMapping,
          type: 'general'
        }]
      ]));

      return callback(publishedAndScheduledSampleBatch)
        .then(function () {
          expect(lib.pageExists.calledOnce).to.be.false;
        });
    });

    it('when the callback is invoked, it updates the data of a page', function () {
      // Stubs
      sandbox.stub(lib, 'pageExists').returns(Promise.resolve([true]));
      sandbox.stub(lib, 'updateExistingPageData');
      sandbox.stub(lib, 'getPage').returns(Promise.resolve({
        _index: 'pages_v1',
        _type: 'general',
        _id: 'localhost/siteName/pages/foo',
        _version: 9,
        found: true,
        _source: {
          uri: 'localhost/siteName/pages/foo',
          published: false,
          scheduled: false,
          scheduledTime: null,
          publishTime: null,
          url: '',
          title: '',
          authors: [],
          siteSlug: 'siteName'
        }
      }));

      search.applyOpFilters.returns(Promise.resolve([
        [{
          ops: sampleBatchOp,
          mapping: sampleMapping,
          type: 'general'
        }]
      ]));
      search.batch.returns(Promise.resolve());
      sites.getSite.returns({ host: 'someSite', path: '/somePath' });
      search.update.returns(Promise.resolve({ _id: 'localhost/siteName/pages/foo' }));


      return callback(sampleBatchOp)
        .then(function () {
          expect(lib.updateExistingPageData.calledOnce).to.be.true;
        });
    });
  });

  describe('filterForPageOps', function () {
    const fn = lib[this.title],
      ops = [{
        type: 'put',
        key: 'host/path/pages/foo'
      }, {
        type: 'put',
        key: 'host/path/components/bar'
      }],
      expected = [{
        type: 'put',
        key: 'host/path/pages/foo'
      }];

    it('filters ops for pages', function () {
      expect(fn(ops)).to.deep.equal(expected);
    });
  });

  describe('getPage', function () {
    const fn = lib[this.title];

    it('calls the `getDocument` function provided by the search service', function () {
      search.getDocument.returns(Promise.resolve({
        _index: 'pages_v1',
        _type: 'general',
        _id: 'localhost/siteName/pages/foo',
        _version: 9,
        found: true,
        _source: {
          uri: 'localhost/siteName/pages/foo',
          published: false,
          scheduled: false,
          scheduledTime: null,
          publishTime: null,
          url: '',
          title: '',
          authors: [],
          siteSlug: 'siteName'
        }
      }));

      return fn('localhost/siteName/pages/foo')
        .then(function (resp) {
          expect(resp._id).to.equal('localhost/siteName/pages/foo');
        });
    });
  });

  describe('pageExists', function () {
    const fn = lib[this.title],
      ops = [{
        key: 'localhost/siteName/pages/foo',
      }, {
        key: 'localhost/siteName/pages/bar'
      }];

    it('calls the `existsDocument` function provided by the search service for each page op', function () {
      search.existsDocument.returns(Promise.resolve(true));

      return fn(ops)
        .then(function (resp) {
          expect(resp).to.deep.equal([true, true]);
        });
    });
  });

  describe('updatePageData', function () {
    const fn = lib[this.title];

    it('throws an error when no data is supplied', function () {
      var result = function () {
        fn();
      };

      expect(result).to.throw(Error);
    });

    it('catches when the update fails', function () {
      search.update.returns(Promise.reject({ stack: 'update failed' }));

      return fn('id', { data: true })
        .then(function (resp) {
          expect(resp).to.deep.equal({ stack: 'update failed' });
        });
    });

    it('updates page data', function () {
      search.update.returns(Promise.resolve({ _id: 'some/page/uri' }));

      return fn('id', { data: true })
        .then(function (resp) {
          expect(resp).to.deep.equal({ _id: 'some/page/uri'});
        });
    });
  });

  describe('sitesIndex', function () {
    const fn = lib[this.title];

    it('calls the `batch` function of the search service for each site', function () {
      sites.sites.returns({
        coolSite: {
          name: 'Cool Site',
          host: 'coolsite.com',
          path: '/',
          assetDir: 'public',
          assetPath: '/',
          port: 80,
          resolveMedia: _.noop,
          resolvePublishing: _.noop
        }
      });
      sandbox.stub(path, 'resolve').returns('some/path/to/img');
      sandbox.stub(_, 'intersection').returns([]);
      search.batch.returns(Promise.resolve('save'));


      return fn()
        .then(function () {
          expect(search.batch.calledOnce).to.be.true;
        });
    });
  });

  describe('getPageList', function () {
    const fn = lib[this.title];

    it('calls the `expectJSON` function', function () {
      fn();

      expect(responses.expectJSON.calledOnce).to.be.true;
    });
  });

  describe('getSiteList', function () {
    const fn = lib[this.title];

    it('calls the `expectJSON` function', function () {
      fn();

      expect(responses.expectJSON.calledOnce).to.be.true;
    });
  });

  describe('searchPages', function () {
    const fn = lib[this.title];

    it('calls the `expectJSON` function', function () {
      fn({ body: '{query:"someQuery"}' });

      expect(responses.expectJSON.calledOnce).to.be.true;
    });
  });

  describe('getAllPages', function () {
    const fn = lib[this.title];

    it('returns a promise with all page data', function () {
      var pageData = {
        total: 1,
        max_score: 1,
        hits: [{
          _index: 'pages_v1',
          _type: 'general',
          _id: 'host/site/pages/foo',
          _score: 1,
          _source: {
            uri: 'host/site/pages/foo',
            published: true,
            scheduled: false,
            scheduledTime: null,
            publishTime: '2016-12-20T15:11:38.613Z',
            url: '',
            title: '',
            authors: [],
            siteSlug: 'site'
          }
        }]
      };

      search.query.returns(Promise.resolve(pageData));

      return fn()
        .then(function (resp) {
          expect(resp).to.deep.equal(_.get(pageData, 'hits'));
        });
    });
  });

  describe('getAllSites', function () {
    const fn = lib[this.title];

    it('returns a response object from elastic', function () {
      var siteData = {
        total: 1,
        max_score: 1,
        hits: [{
          _index: 'sites_v1',
          _type: 'general',
          _id: 'coolsite',
          _score: 1,
          _source: {
            name: 'Cool Site',
            host: 'coolsite.com',
            path: '/',
            assetDir: 'public',
            assetPath: '/'
          }
        }]
      };

      search.query.returns(Promise.resolve(siteData));

      return fn()
        .then(function (resp) {
          expect(resp).to.deep.equal(_.get(siteData, 'hits'));
        });
    });
  });

  describe('queryPages', function () {
    const fn = lib[this.title],
      callback = fn('{"body":{"query":"Some query"}}');

    it('returns a response object from elastic', function () {
      var siteData = {
        total: 1,
        max_score: 1,
        hits: [{
          _index: 'sites_v1',
          _type: 'general',
          _id: 'coolsite',
          _score: 1,
          _source: {
            name: 'Cool Site',
            host: 'coolsite.com',
            path: '/',
            assetDir: 'public',
            assetPath: '/'
          }
        }]
      };

      search.query.returns(Promise.resolve(siteData));

      return callback()
        .then(function (resp) {
          expect(resp).to.deep.equal(_.get(siteData, 'hits'));
        });
    });
  });

  describe('pageTitleService', function () {
    const fn = lib[this.title];

    it('throws an error if title is not a string', function () {
      var result = function () {
        fn('someURI', 1232);
      };

      expect(result).to.throw(Error);
    });

    it('throws an error if no pageUri is provided', function () {
      var result = function () {
        fn('', 'Some Title');
      };

      expect(result).to.throw(Error);
    });

    it('throws an error if pageUri is not a String', function () {
      var result = function () {
        fn(21123123, 'Some Title');
      };

      expect(result).to.throw(Error);
    });

    it('calls the updatePageData function', function () {
      sandbox.stub(lib, 'updatePageData').returns(Promise.resolve());

      return fn('someUri', 'Some Title')
        .then(function () {
          expect(lib.updatePageData.calledOnce).to.be.true;
        });
    });
  });

  describe('pageAuthorsService', function () {
    const fn = lib[this.title];

    it('throws an error if authors is not an array', function () {
      var result = function () {
        fn('someURI', 'Author Name');
      };

      expect(result).to.throw(Error);
    });

    it('throws an error if no pageUri is provided', function () {
      var result = function () {
        fn('', ['author name', 'another author']);
      };

      expect(result).to.throw(Error);
    });

    it('throws an error if pageUri is not a String', function () {
      var result = function () {
        fn(21123123, ['author name', 'another author']);
      };

      expect(result).to.throw(Error);
    });

    it('works', function () {
      sandbox.stub(lib, 'updatePageData').returns(Promise.resolve());

      return fn('someUri', ['author name', 'another author'])
        .then(function () {
          expect(lib.updatePageData.calledOnce).to.be.true;
        });
    });
  });

  describe('updateExistingPageData', function () {
    const fn = lib[this.title];

    it('handles scheduled and published ops', function () {
      sandbox.stub(lib, 'getPage').returns(Promise.resolve({
        _index: 'pages_v1',
        _type: 'general',
        _id: 'localhost/siteName/pages/foo',
        _version: 9,
        found: true,
        _source: {
          uri: 'localhost/siteName/pages/foo',
          published: false,
          scheduled: false,
          scheduledTime: null,
          publishTime: null,
          url: '',
          title: '',
          authors: [],
          siteSlug: 'siteName'
        }
      }));
      sandbox.stub(lib, 'updatePageData').returns(Promise.resolve());

      return fn(publishedAndScheduledSampleBatch)
        .then(function () {
          expect(lib.updatePageData.callCount).to.equal(2);
        });
    });
  });

  describe('findSite', function () {
    const fn = lib[this.title],
      exampleSite = {
        name: 'Brand Name',
        host: 'localhost.brand.com',
        path: '',
        assetDir: 'assets',
        assetPath: '',
        slug: 'foobar',
        prefix: 'localhost.brand.com/brand/brand'
      };

    it('returns a site based based on the host', function () {
      sites.getSite.returns(exampleSite);

      expect(fn('localhost.brand.com/pages/xyz')).to.deep.equal(exampleSite);
    });

    it('returns a site based based on the prefix', function () {
      sites.getSiteFromPrefix.returns(exampleSite);

      expect(fn('localhost.brand.com/pages/xyz')).to.deep.equal(exampleSite);
    });
  });

  describe('constructMediaPath', function () {
    const fn = lib[this.title],
      exampleSiteOne = {
        name: 'Cool Site',
        host: 'coolsite.com',
        path: '/',
        assetDir: 'public',
        assetPath: '/asset/path',
        port: 3001,
        resolveMedia: _.noop,
        resolvePublishing: _.noop
      },
      exampleSiteTwo = {
        name: 'Cool Site',
        host: 'coolsite.com',
        path: '/',
        slug: 'verycool',
        assetDir: 'public',
        assetPath: '',
        port: 3001,
        resolveMedia: _.noop,
        resolvePublishing: _.noop
      };

    it('returns a path based off the assetPath', function () {
      expect(fn(exampleSiteOne)).to.equal('coolsite.com:3001/asset/path/media/sites/asset/path/');
    });

    it('returns a path based off the slug', function () {
      expect(fn(exampleSiteTwo)).to.equal('coolsite.com:3001/media/sites/verycool/');
    });
  });

  describe('parsePayload', function () {
    const fn = lib[this.title],
      payload = {
        body: {
          someProp: 'someValue'
        }
      };

    it('returns a path based off the assetPath', function () {
      expect(fn(payload)).to.deep.equal(_.get(payload, 'body'));
    });
  });
});

