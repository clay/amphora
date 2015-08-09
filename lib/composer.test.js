'use strict';
var _ = require('lodash'),
  filename = __filename.split('/').pop().split('.').shift(),
  expect = require('chai').expect,
  sinon = require('sinon'),
  lib = require('./' + filename),
  db = require('./services/db'),
  bluebird = require('bluebird'),
  files = require('./files'),
  log = require('./log'),
  plex = require('multiplex-templates'),
  siteService = require('./sites'),
  media = require('./media'),
  components = require('./services/components'),
  createMockReq = require('../test/fixtures/mocks/req'),
  createMockRes = require('../test/fixtures/mocks/res');

describe(_.startCase(filename), function () {
  var sandbox,
    mockSite = 'mockSite';

  /**
   * Promise that resolve
   * @param {string|object} str
   * @returns {Promise.string}
   */
  function resolveString(str) {
    if (typeof str === 'object') {
      str = JSON.stringify(str);
    }
    return bluebird.resolve(str);
  }

  /**
   * @returns {object}
   */
  function getMockRes(fn) {
    var res = createMockRes(),
      req = createMockReq();

    res.req = req;

    // mock this always, sometimes with a fn (don't make actual express calls)
    sandbox.stub(res, 'send', fn);

    return res;
  }

  function expectCallCount(spy, method, number) {
    var callCount = spy[method].callCount;

    require('chai').assert(callCount === number, 'expected ' + method + ' to be called ' + number + ', not ' + callCount);
  }

  beforeEach(function () {
    sandbox = sinon.sandbox.create();

    sandbox.stub(db);
    sandbox.stub(log);
    sandbox.stub(components);
    sandbox.stub(plex, 'render');
    sandbox.stub(files, 'getComponentModule');
    sandbox.stub(siteService, 'sites');
    sandbox.stub(media, 'appendTop', _.constant(_.identity));
    sandbox.stub(media, 'appendBottom', _.constant(_.identity));

    siteService.sites.returns({
      someSite: {
        host: 'example.com',
        slug: 'a',
        path: '/'
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
    expectCallCount(log, 'info', 0);
    expectCallCount(log, 'warn', 0);
    expectCallCount(log, 'error', 0);
  }

  describe('renderComponent', function () {
    var fn = lib[this.title];

    it('throws if data not found, no logging', function (done) {
      components.get.returns(bluebird.reject(new Error('thing')));

      fn('/components/whatever', getMockRes()).done(function () {
        done('should throw');
      }, function () {
        // should not fetch template if there is no data, that would be a waste
        expectCallCount(components, 'getTemplate', 0);

        // should attempt to fetch the data, for sure.
        expectCallCount(components, 'get', 1);

        expectNoLogging();
        done();
      });
    });

    it('renders and logs if data found', function () {
      components.getTemplate.returns('some/path');
      components.get.returns(bluebird.resolve({site: mockSite}));

      return fn('/components/whatever', getMockRes()).then(function () {
        expectCallCount(plex, 'render', 1);
        expectCallCount(components, 'get', 1);
        expectCallCount(components, 'getTemplate', 1);

        // report what was served
        expectCallCount(log, 'info', 1);
      });
    });

    it('throws if no template found', function (done) {
      components.get.returns(bluebird.resolve({site: mockSite}));

      fn('/components/whatever', getMockRes()).done(function () {
        done('should throw');
      }, function () {
        // should not fetch template if there is no data, that would be a waste
        expectCallCount(components, 'getTemplate', 1);

        // should attempt to fetch the data, for sure.
        expectCallCount(components, 'get', 1);

        expectCallCount(log, 'info', 1);
        done();
      });
    });

    it('sets site query param', function () {
      var res = getMockRes(),
        mockSiteName = 'x',
        mockQuery = {site: mockSiteName};

      res.req.query = mockQuery; // Adding query params.
      components.getTemplate.returns('some/path');
      components.get.returns(bluebird.resolve({site: mockSiteName}));

      return fn('/components/whatever', res).then(function () {
        var plexArg = plex.render.getCall(0).args[1],
          componentsArg = components.get.getCall(0).args[1];

        expect(componentsArg.site).to.equal(mockSiteName); // site query param to site
        expect(plexArg.locals.site).to.equal(mockSiteName); // site query params in locals
      });
    });
  });

  describe('renderPage', function () {
    var fn = lib[this.title];

    it('follows the basic process', function () {
      var res = getMockRes();

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
        expectCallCount(db, 'get', 1);
        expectCallCount(plex, 'render', 1);
        expectCallCount(components, 'get', 1);
        expectCallCount(components, 'getTemplate', 1);
        expectCallCount(res, 'send', 0);

        // report what was served
        expectCallCount(log, 'info', 1);
      });
    });

    it('allows arrays in page data with components on either side in layout', function () {
      var pageRef = '/pages/whatever',
        layoutRef = '/components/hey',
        layoutData = {areaA: [{_ref: '/components/c'}, 'head', {_ref: '/components/d'}]},
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
        var areaA = plex.render.args[0][1].areaA;

        expect(areaA).to.deep.equal([
          { _ref: '/components/c', whatever: 'whatever' },
          { _ref: '/components/a', whatever: 'whatever' },
          { _ref: '/components/b', whatever: 'whatever' },
          { _ref: '/components/d', whatever: 'whatever' }
        ]);

        // report what was served
        expectCallCount(log, 'info', 1);
      });
    });

    it('warns if missing reference in layout', function () {
      var pageRef = '/pages/whatever',
        layoutRef = '/components/hey',
        layoutData = {areaA: ['head']},
        pageData = {layout: layoutRef},
        template = '...';

      plex.render.returns('<thing></thing>');
      db.get.withArgs(pageRef).returns(resolveString(pageData));
      components.get.withArgs(layoutRef).returns(bluebird.resolve(layoutData));
      components.getTemplate.returns(template);

      return fn(pageRef, getMockRes()).then(function () {
        expectCallCount(log, 'warn', 1);
      });
    });

    it('warns if data in page is not a reference', function () {
      var pageRef = '/pages/whatever',
        layoutRef = '/components/hey',
        layoutData = {areaA: ['head']},
        pageData = {layout: layoutRef, head: {}},
        template = '...';

      plex.render.returns('<thing></thing>');
      db.get.withArgs(pageRef).returns(resolveString(pageData));
      components.get.withArgs(layoutRef).returns(bluebird.resolve(layoutData));
      components.getTemplate.returns(template);

      return fn(pageRef, getMockRes()).then(function () {
        expectCallCount(log, 'warn', 1);
      });
    });

    it('throws if edit mode and it has a version', function () {
      expect(function () {
        fn('/components/thing@some-version', {req: {query: {edit: true}}});
      }).to.throw();
    });
  });

  describe('renderUri', function () {
    var fn = lib[this.title];

    it('uses uri route if matching', function () {
      var resultRef = 'whatever or something';

      // when we find the new reference
      db.get.returns(bluebird.resolve(resultRef));

      // with these uri handlers
      lib.setUriRouteHandlers([{
        when: /^whatever/,
        html: function (ref, res) {
          expect(ref).to.equal(resultRef);
          expect(res).to.equal(res);
        }
      }]);

      return fn('/uris/asdf', getMockRes()).then(function () {
        expectNoLogging();
      });
    });

    it('throws if no matching uri route', function (done) {
      var resultRef = 'whatever or something';

      // when we find the new reference
      db.get.returns(bluebird.resolve(resultRef));

      // with these uri handlers
      lib.setUriRouteHandlers([{
        when: /^notMatching/,
        html: _.noop
      }]);

      fn('/uris/asdf', getMockRes()).then(function () {
        done('should throw');
      }).catch(function () {
        expectNoLogging();
        done();
      });
    });
  });

  describe('resolveDataReferences', function () {
    var fn = lib[this.title];

    beforeEach(function () {
      lib.setUriRouteHandlers([{
        when: /^\/c\//,
        json: function (ref) { return db.get(ref).then(JSON.parse); }
      }]);
    });

    it('looks up references', function () {
      var data = {
          a: {_ref:'/c/b'},
          c: {d: {_ref:'/c/e'}}
        };

      db.get.withArgs('/c/b').returns(resolveString({g: 'h'}));
      db.get.withArgs('/c/e').returns(resolveString({i: 'j'}));

      return fn(data).then(function (result) {
        expect(result).to.deep.equal({
          a: { _ref: '/c/b', g: 'h' },
          c: { d: { _ref: '/c/e', i: 'j' } }
        });

        expectNoLogging();
      });
    });

    it('looks up references recursively', function () {
      var data = {
          a: {_ref:'/c/b'},
          c: {d: {_ref:'/c/e'}}
        };

      db.get.withArgs('/c/b').returns(resolveString({g: 'h'}));
      db.get.withArgs('/c/e').returns(resolveString({i: 'j', k: {_ref:'/c/m'}}));
      db.get.withArgs('/c/m').returns(resolveString({n: 'o'}));

      return fn(data).then(function (result) {
        expect(result).to.deep.equal({
          a: { _ref: '/c/b', g: 'h' },
          c: { d: {
            _ref: '/c/e',
            i: 'j',
            k: {
              _ref: '/c/m',
              n: 'o' // we just recursively looked this up from another lookup
            }
          } }
        });

        expectNoLogging();
      });
    });
  });

  it('passes error to Express: missing site information', function (done) {
    var res = getMockRes(function () { done('should throw'); });

    delete res.locals;

    lib(res.req, res, function (result) {
      expect(result).to.be.instanceOf(Error);
      expect(result.message).to.match(/missing site/i);
      expectNoLogging();
      done();
    });
  });

  it('passes error to Express: site does not exist', function (done) {
    var res = getMockRes(function () { done('should throw'); });

    res.locals.site = 'asdf';

    lib(res.req, res, function (result) {
      expect(result).to.be.instanceOf(Error);
      expect(result.message).to.match(/site does not exist/i);
      expectNoLogging();
      done();
    });
  });

  it('gets page without query string', function (done) {
    var res = getMockRes(function () { done('should throw'); }),
      req = res.req,
      expectedUri = 'example.com/someUrl',
      pathOnBase64 = 'example.com/uris/' + new Buffer(expectedUri).toString('base64');

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

  it('renders page after following uri', function (done) {
    var res = getMockRes(function () { done(); }),
      expectedUri = 'example.com/someUrl',
      pathOnBase64 = 'example.com/uris/' + new Buffer(expectedUri).toString('base64'),
      template = '...';

    db.get.withArgs(pathOnBase64).returns(bluebird.resolve('example.com/pages/a'));
    db.get.withArgs('example.com/pages/a@published').returns(resolveString({layout: 'example.com/components/b'}));
    components.get.withArgs('example.com/components/b').returns(bluebird.resolve({}));
    components.getTemplate.returns(template);
    plex.render.returns('<thing></thing>');

    lib(res.req, res, function () {
      done('should not throw');
    });
  });
});
