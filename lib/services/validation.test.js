'use strict';

const _ = require('lodash'),
  filename = __filename.split('/').pop().split('.').shift(),
  lib = require('./' + filename),
  sinon = require('sinon'),
  siteService = require('./sites'),
  expect = require('chai').expect,
  locals = {
    site: {
      slug: 'domain'
    }
  };

describe(_.startCase(filename), function () {
  let sandbox;

  beforeEach(function () {
    sandbox = sinon.sandbox.create();

    sandbox.stub(siteService, 'getSiteFromPrefix').callsFake(function fake(prefix) {
      const sites = {
        'domain.com': locals.site,
        'other.com': { slug: 'notit' }
      };

      return sites[prefix];
    });
  });

  afterEach(function () {
    sandbox.restore();
  });

  describe('validateSite', function () {
    const fn = lib.validateSite;

    it('will not throw if no error', function () {
      const uri = 'domain.com/_pages/foo';

      fn(uri, locals);
      sinon.assert.calledOnce(siteService.getSiteFromPrefix);
    });

    it('will throw if site does not exist for uri', function () {
      const uri = 'idontexist.com/_pages/foo';

      try {
        fn(uri, locals);
      } catch (e) {
        expect(e.message).to.eql(`Site for URI not found, ${uri}`);
      }
    });

    it('will throw if locals does not have a site', function () {
      const uri = 'domain.com/_pages/foo';

      try {
        fn(uri, {});
      } catch (e) {
        expect(e.message).to.eql('Site not found on locals.');
      }
    });

    it('will throw if uri different site than locals', function () {
      const uri = 'other.com/_pages/foo';

      try {
        fn(uri, locals);
      } catch (e) {
        expect(e.message).to.eql('URI Site (notit) not the same as current site (domain)');
      }
    });
  });

  describe('validatePage', function () {
    const fn = lib.validatePage;

    it('will not throw if no error', function () {
      const uri = 'domain.com/_pages/foo',
        data = {
          head: [
            'domain.com/_components/header/instances/foo'
          ],
          main:[
            'domain.com/_components/article/instances/foo'
          ],
          layout: 'domain.com/_layouts/layout/instances/article'
        };

      fn(uri, data, locals);
      sinon.assert.callCount(siteService.getSiteFromPrefix, 4);
    });

    it('will throw error if page URI invalid', function () {
      const uri = 'domain.com/im/not/a/page/uri',
        data = {
          head: [
            'domain.com/_components/header/instances/foo'
          ],
          main:[
            'domain.com/_components/article/instances/foo'
          ],
          layout: 'domain.com/_layouts/layout/instances/article'
        };

      try {
        fn(uri, data, locals);
      } catch (e) {
        expect(e.message).to.eql(`Page URI invalid, '${uri}'`);
      }
    });

    it('will throw error if layout URI invalid', function () {
      const uri = 'domain.com/_pages/foo',
        data = {
          head: [
            'domain.com/_components/header/instances/foo'
          ],
          main:[
            'domain.com/_components/article/instances/foo'
          ],
          layout: 'domain.com/im/not/a/layout'
        };

      try {
        fn(uri, data, locals);
      } catch (e) {
        expect(e.message).to.eql('Page must contain a `layout` property whose value is a `_layouts` instance');
      }
    });

    it('will not throw if no error', function () {
      const uri = 'domain.com/_pages/foo',
        data = {
          head: [
            'domain.com/_components/header/instances/foo'
          ],
          main:[
            'domain.com/im/not/a/component'
          ],
          layout: 'domain.com/_layouts/layout/instances/article'
        };

      try {
        fn(uri, data, locals);
      } catch (e) {
        expect(e.message).to.eql('Page references a non-valid component: domain.com/im/not/a/component');
      }
    });
  });
});
