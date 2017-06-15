'use strict';
const _ = require('lodash'),
  filename = __filename.split('/').pop().split('.').shift(),
  buf = require('./services/buffer'),
  expect = require('chai').expect,
  sinon = require('sinon'),
  lib = require('./' + filename),
  db = require('./services/db'),
  bluebird = require('bluebird'),
  files = require('./files'),
  winston = require('winston'),
  plex = require('multiplex-templates'),
  siteService = require('./services/sites'),
  schema = require('./schema'),
  components = require('./services/components'),
  createMockReq = require('../test/fixtures/mocks/req'),
  createMockRes = require('../test/fixtures/mocks/res');

describe(_.startCase(filename), function () {
  let sandbox,
    mockSite = 'mockSite';

  /**
   * Promise that resolve
   * @param {string|object} str
   * @returns {Promise.string}
   */
  function resolveString(str) {
    return bluebird.resolve(JSON.stringify(str));
  }

  /**
   * @param {Function} fn
   * @returns {object}
   */
  function getMockRes(fn) {
    const res = createMockRes(),
      req = createMockReq();

    res.req = req;
    res.locals.site = {
      host: 'example.com',
      slug: 'a',
      path: '/'
    };

    // mock this always, sometimes with a fn (don't make actual express calls)
    sandbox.stub(res, 'send', fn);
    sandbox.stub(res, 'redirect', fn);

    return res;
  }

  function expectCallCount(spy, method, number) {
    const callCount = spy[method].callCount;

    require('chai').assert(callCount === number, 'expected ' + method + ' to be called ' + number + ', not ' + callCount);
  }

  beforeEach(function () {
    sandbox = sinon.sandbox.create();

    sandbox.stub(db);
    sandbox.stub(winston);
    sandbox.stub(components);
    sandbox.stub(plex, 'render');
    sandbox.stub(files);
    sandbox.stub(siteService, 'sites');
    sandbox.stub(schema, 'getSchema');

    siteService.sites.returns({
      a: {
        host: 'example.com',
        slug: 'a',
        path: '/'
      },
      b: {
        host: 'other.com',
        slug: 'b',
        path: '/other'
      }
    });

    lib.resetUriRouteHandlers();
  });

  afterEach(function () {
    sandbox.restore();
  });

  after(function () {
    lib.resetUriRouteHandlers();
  });

  function expectNoLogging() {
    sinon.assert.notCalled(winston.log);
    sinon.assert.notCalled(winston.info);
    sinon.assert.notCalled(winston.warn);
    sinon.assert.notCalled(winston.error);
  }

  describe('renderComponent', function () {
    const fn = lib[this.title];

    it('throws if data not found, no logging', function (done) {
      components.get.returns(bluebird.reject(new Error('thing')));

      fn('/components/whatever', getMockRes()).then(done.bind(null, 'should throw'), function () {
        // should not fetch template if there is no data, that would be a waste
        sinon.assert.callCount(components.getTemplate, 0);

        // should attempt to fetch the data, for sure.
        sinon.assert.callCount(components.get, 1);

        expectNoLogging();
        done();
      });
    });

    it('renders and logs if data found', function () {
      components.getTemplate.returns('some/path');
      components.get.returns(bluebird.resolve({site: mockSite}));

      return fn('/components/whatever', getMockRes()).then(function () {
        sinon.assert.callCount(plex.render, 1);
        sinon.assert.callCount(components.get, 1);
        sinon.assert.callCount(components.getTemplate, 1);
        expectNoLogging();
      });
    });

    it('throws if no template found', function (done) {
      components.get.returns(bluebird.resolve({site: mockSite}));

      fn('/components/whatever', getMockRes()).then(done.bind(null, 'should throw'), function () {
        // should not fetch template if there is no data, that would be a waste
        sinon.assert.callCount(components.getTemplate, 1);

        // should attempt to fetch the data, for sure.
        sinon.assert.callCount(components.get, 1);
        expectNoLogging();
        done();
      });
    });
  });

  describe('renderPage', function () {
    const fn = lib[this.title];

    it('follows the basic process', function () {
      const res = getMockRes();

      // THIS IS WHAT WE EXPECT FROM THE BASIC PROCESS:

      // 1. look up page
      db.get.returns(resolveString({layout: '/components/hey'}));

      // 2. get the data that will be composed in the template
      components.get.returns(bluebird.resolve({}));

      // 3. get the template that will be composed
      components.getTemplate.returns('asdf');

      // 4. rendering should happen (they should NOT try to send this on their own)
      // 5. log success

      return fn('/pages/whatever', res).then(function () {
        sinon.assert.callCount(db.get, 1);
        sinon.assert.callCount(plex.render, 1);
        sinon.assert.callCount(components.get, 1);
        sinon.assert.callCount(components.getTemplate, 1);
        sinon.assert.callCount(res.send, 0);
        expectNoLogging();
      });
    });

    it('maps page data into the layout', function () {
      const pageRef = '/pages/whatever',
        layoutRef = '/components/hey',
        layoutData = {head: 'head', areaA: [{_ref: '/components/c'}, {_ref: '/components/d'}]},
        pageData = {layout: layoutRef, head: ['/components/a', '/components/b']},
        mockComponentData = {whatever: 'whatever'},
        template = '...';

      plex.render.returns('<thing></thing>');
      db.get.withArgs(pageRef).returns(resolveString(pageData));
      components.get.withArgs(layoutRef).returns(bluebird.resolve(layoutData));
      components.get.withArgs('/components/a').returns(bluebird.resolve(mockComponentData));
      components.get.withArgs('/components/b').returns(bluebird.resolve(mockComponentData));
      components.get.withArgs('/components/c').returns(bluebird.resolve(mockComponentData));
      components.get.withArgs('/components/d').returns(bluebird.resolve(mockComponentData));
      components.getTemplate.returns(template);

      return fn(pageRef, getMockRes()).then(function () {
        const head = plex.render.args[0][1].head,
          areaA = plex.render.args[0][1].areaA;

        expect(head).to.deep.equal([
          { _ref: '/components/a', whatever: 'whatever' },
          { _ref: '/components/b', whatever: 'whatever' }
        ]);
        expect(areaA).to.deep.equal([
          { _ref: '/components/c', whatever: 'whatever' },
          { _ref: '/components/d', whatever: 'whatever' }
        ]);
        expectNoLogging();
      });
    });



    it('throws if edit mode and it has a version', function () {
      expect(function () {
        fn('/components/thing@some-version', {req: {query: {edit: true}}});
      }).to.throw();
    });
  });

  describe('renderUri', function () {
    const fn = lib[this.title];

    it('uses uri route if matching', function () {
      const resultRef = 'whatever or something';

      // when we find the new reference
      db.get.returns(bluebird.resolve(resultRef));

      // with these uri handlers
      lib.setUriRouteHandlers([{
        when: /^whatever/,
        html(ref, res) {
          expect(ref).to.equal(resultRef);
          expect(res).to.equal(res);
        }
      }]);

      return fn('/uris/asdf', getMockRes()).then(function () {
        expectNoLogging();
      });
    });

    it('redirects if uri matches another uri', function () {
      const resultRef = 'domain.com/uris/zxccv',
        mockRes = getMockRes();

      // when we find the new reference
      db.get.returns(bluebird.resolve('domain.com/uris/' + buf.encode(resultRef)));

      return fn('/uris/asdf', mockRes).then(function () {
        expect(mockRes.redirect.callCount).to.equal(1);
      });
    });

    it('throws if no matching uri route', function (done) {
      const resultRef = 'whatever or something';

      // when we find the new reference
      db.get.returns(bluebird.resolve(resultRef));

      // with these uri handlers
      lib.setUriRouteHandlers([{
        when: /^notMatching/,
        html: _.noop
      }]);

      fn('/uris/asdf', getMockRes())
        .then(done.bind(null, 'should throw'))
        .catch(function () {
          expectNoLogging();
          done();
        });
    });
  });

  describe('addEngines', function () {
    const fn = lib[this.title];

    it('sets engines', function () {
      expect(function () {
        fn({});
      }).to.not.throw();
    });
  });

  it('gets page without query string', function (done) {
    const res = getMockRes(done.bind(null, 'should throw')),
      req = res.req,
      expectedUri = 'example.com/someUrl',
      pathOnBase64 = 'example.com/uris/' + buf.encode(expectedUri);

    req.query = {hey: 'hey'};

    // verify that what we think is true is really true before trying the test
    expect(req.originalUrl).to.equal('/someUrl?hey=hey');
    expect(req.uri).to.equal('example.com/someUrl');

    db.get.withArgs(pathOnBase64).returns(bluebird.reject(new Error('not under test')));

    lib(res.req, res, function (result) {
      expect(result).to.be.instanceOf(Error);

      expectCallCount(db, 'get', 1);
      expectNoLogging();
      done();
    });
  });

  it('redirects after following uri', function (done) {
    const res = getMockRes(function () { done(); }),
      expectedUri = 'example.com/someUrl',
      expectedOtherUri = 'example.com/someOtherUrl',
      pathOnBase64 = 'example.com/uris/' + buf.encode(expectedUri);

    db.get.withArgs(pathOnBase64).returns(bluebird.resolve('example.com/uris/' + buf.encode(expectedOtherUri)));

    lib(res.req, res, done.bind(null, 'should not throw'));
  });

  it('renders page after following uri', function (done) {
    const res = getMockRes(function () { done(); }),
      expectedUri = 'example.com/someUrl',
      pathOnBase64 = 'example.com/uris/' + buf.encode(expectedUri),
      template = '...';

    db.get.withArgs(pathOnBase64).returns(bluebird.resolve('example.com/pages/a'));
    db.get.withArgs('example.com/pages/a@published').returns(resolveString({layout: 'example.com/components/b'}));
    components.get.withArgs('example.com/components/b').returns(bluebird.resolve({}));
    components.getTemplate.returns(template);
    plex.render.returns('<thing></thing>');

    lib(res.req, res, done.bind(null, 'should not throw'));
  });

  it('renders page with a path', function (done) {
    const res = getMockRes(function () { done(); }),
      expectedUri = 'example.com/some-path/someUrl',
      pathOnBase64 = 'example.com/some-path/uris/' + buf.encode(expectedUri),
      template = '...';

    res.req.baseUrl = '/some-path';
    res.locals.site.path = '/some-path';
    db.get.withArgs(pathOnBase64).returns(bluebird.resolve('example.com/some-path/pages/a'));
    db.get.withArgs('example.com/some-path/pages/a@published').returns(resolveString({layout: 'example.com/some-path/components/b'}));
    components.get.withArgs('example.com/some-path/components/b').returns(bluebird.resolve({}));
    components.getTemplate.returns(template);
    plex.render.returns('<thing></thing>');

    lib(res.req, res, done.bind(null, 'should not throw'));
  });

  it('skips page that is not found, looking for next route', function (done) {
    const res = getMockRes(),
      expectedUri = 'example.com/some-path/someUrl',
      pathOnBase64 = 'example.com/some-path/uris/' + buf.encode(expectedUri),
      error = new Error();

    error.name = 'NotFoundError';
    res.req.baseUrl = '/some-path';
    res.locals.site.path = '/some-path';
    db.get.withArgs(pathOnBase64).returns(bluebird.reject(error));

    lib(res.req, res, done);
  });

  it('renders latest page if editing', function (done) {
    const res = getMockRes(function () { done(); }),
      expectedUri = 'example.com/some-path/someUrl',
      pathOnBase64 = 'example.com/some-path/uris/' + buf.encode(expectedUri),
      template = '...';

    res.req.baseUrl = '/some-path';
    res.req.query = {edit: 'whatever'};
    res.locals.site.path = '/some-path';
    db.get.withArgs(pathOnBase64).returns(bluebird.resolve('example.com/some-path/pages/a'));
    db.get.withArgs('example.com/some-path/pages/a').returns(resolveString({layout: 'example.com/some-path/components/b'}));
    components.get.withArgs('example.com/some-path/components/b').returns(bluebird.resolve({}));
    components.getTemplate.returns(template);
    plex.render.returns('<thing></thing>');

    lib(res.req, res, done);
  });

  describe('refToObj', function () {
    const fn = lib[this.title];

    it('sets data to be the value of an object with key "_ref"', function () {
      const data = { key: 'value'},
        expectedResultData =  { _ref: data },
        newData = fn(data);

      expect(newData).to.deep.equal(expectedResultData);
    });
  });

  describe('mapLayoutToPageData', function () {
    const fn = lib[this.title];

    it('replaces references from layout data with page data', function () {
      const pageData = {
          main: [{ key: 'value'}]
        },
        layoutData = {
          main: 'main'
        },
        expectedResultData = {
          main: [lib.refToObj({ key: 'value'})]
        },
        newData = fn(pageData, layoutData);

      expect(newData).to.deep.equal(expectedResultData);
    });

    it('replaces missing references with []', function () {
      const pageData = {},
        layoutData = {
          main: 'main'
        },
        expectedResultData = {
          main: []
        },
        newData = fn(pageData, layoutData);

      expect(newData).to.deep.equal(expectedResultData);
    });
  });
});
