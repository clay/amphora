'use strict';

const _ = require('lodash'),
  bluebird = require('bluebird'),
  filename = __filename.split('/').pop().split('.').shift(),
  db = require('./services/db'),
  lib = require('./' + filename),
  expect = require('chai').expect,
  sinon = require('sinon'),
  schema = require('./schema'),
  components = require('./services/components'),
  composer = require('./services/composer'),
  createMockReq = require('../test/fixtures/mocks/req'),
  createMockRes = require('../test/fixtures/mocks/res');


describe(_.startCase(filename), function () {
  let sandbox,
    mockSite = 'mockSite';

  /**
   * Mock resolveComponentReferences
   * @return {Object}
   */
  function mockResolver() {
    return {
      site: { },
      locals: {},
      _self: '',
      _version: undefined,
      _components: [],
      _componentSchemas: [],
      _data: {}
    };
  }

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
    sandbox.stub(res, 'send').callsFake(fn);
    sandbox.stub(res, 'redirect').callsFake(fn);

    return res;
  }

  function getMockReq() {
    var req = createMockReq();

    return req;
  }

  beforeEach(function () {
    sandbox = sinon.sandbox.create();

    sandbox.stub(db);
    sandbox.stub(components);
    sandbox.stub(composer);
    sandbox.stub(schema);
    lib.resetUriRouteHandlers();
    lib.registerRenderers({
      default: 'html',
      html: {
        render: sinon.spy()
      }
    });
  });

  afterEach(function () {
    sandbox.restore();
  });

  after(function () {
    lib.resetUriRouteHandlers();
    lib.registerRenderers({});
  });

  describe('renderExpressRoute', function () {
    it('logs if the error name is `NotFoundError`', function (done) {
      const res = getMockRes(),
        next = sandbox.spy();
      var error = new Error('error');

      error.name = 'NotFoundError';
      sandbox.stub(lib, 'renderUri').returns(Promise.reject(error));

      lib(res.req, res, next)
        .then(function () {
          sinon.assert.calledOnce(next);
          done();
        });
    });

    it('calls `next()` if error is something other than `NotFoundError`', function (done) {
      const res = getMockRes(),
        next = sandbox.spy();
      var error = new Error('error');

      sandbox.stub(lib, 'renderUri').returns(Promise.reject(error));

      lib(res.req, res, next)
        .then(function () {
          sinon.assert.calledOnce(next);
          done();
        });
    });
  });

  describe('renderPage', function () {
    const fn = lib[this.title];

    it('follows the basic process', function () {
      const res = getMockRes(),
        req = getMockReq();

      composer.resolveComponentReferences.returns(Promise.resolve(mockResolver()));
      db.get.returns(resolveString({layout: '/_components/hey'}));
      components.get.returns(bluebird.resolve({}));

      return fn('/_pages/whatever', req, res).then(function () {
        sinon.assert.callCount(db.get, 1);
        sinon.assert.callCount(components.get, 1);
        sinon.assert.callCount(res.send, 0);
      });
    });
  });

  describe('renderDynamicRoute', function () {
    const fn = lib[this.title];

    it('calls renderPage', function () {
      const res = getMockRes();

      sandbox.stub(lib, 'renderPage');
      fn('someId')('req', res);
      sinon.assert.calledOnce(lib.renderPage);
      sinon.assert.calledWith(lib.renderPage, 'example.com/_pages/someId', 'req', res);
    });
  });

  describe('renderComponent', function () {
    const fn = lib[this.title];

    it('throws if data not found, no logging', function (done) {
      var req = getMockReq();

      components.get.returns(bluebird.reject(new Error('thing')));

      fn(req, getMockRes()).then(done.bind(null, 'should throw'), function () {
        // should attempt to fetch the data, for sure.
        sinon.assert.callCount(components.get, 1);

        done();
      });
    });

    it('throws if renderer not found', function (done) {
      var req = getMockReq(), result;

      req.params.ext = 'womp';
      components.get.returns(bluebird.reject(new Error('thing')));
      result = function () {
        fn(req, getMockRes(), {});
      };

      expect(result).to.throw(Error);
      done();
    });

    it('renders and logs if data found', function () {
      components.get.returns(bluebird.resolve({site: mockSite}));
      composer.resolveComponentReferences.returns(Promise.resolve(mockResolver()));

      return fn(getMockReq(), getMockRes()).then(function () {
        expect(composer.resolveComponentReferences.calledOnce).to.be.true;
      });
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
        default(ref, res) {
          expect(ref).to.equal(resultRef);
          expect(res).to.equal(res);
        }
      }]);

      return fn('/_uris/asdf', getMockRes()).then(function () {
      });
    });

    it('redirects if uri matches another uri', function () {
      const resultRef = 'domain.com/_uris/zxccv',
        mockRes = getMockRes();

      // when we find the new reference
      db.get.returns(bluebird.resolve('domain.com/_uris/' + new Buffer(resultRef).toString('base64')));

      return fn('/_uris/asdf', {}, mockRes).then(function () {
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

      fn('/_uris/asdf', {}, getMockRes())
        .then(done.bind(null, 'should throw'))
        .catch(function () {
          done();
        });
    });
  });

  describe('getExpressRoutePrefix', function () {
    const fn = lib[this.title];

    it('combines the host with prefix and returns a string', function () {
      const site = {
        host: 'site.com',
        path: '/foo'
      };

      expect(fn(site)).to.equal('site.com/foo');
    });
  });

  describe('findRenderer', function () {
    const fn = lib[this.title];

    it('returns the default renderer if none is specified', function () {
      expect(fn()).to.eql(lib.renderers.html);
    });
  });

  describe('assumePublishedUnlessEditing', function () {
    const fn = lib[this.title];

    it('calls the function passed in', function () {
      const func = sinon.spy(),
        req = getMockReq(),
        res = getMockRes(),
        callback = fn(func);

      callback('uri', req, res);

      sinon.assert.calledOnce(func);
    });

    it('defaults to published if not in edit mode', function () {
      var func = sinon.spy(),
        req = getMockReq(),
        res = getMockRes(),
        callback = fn(func);

      res.req.query.edit = true;
      callback('uri', req, res);

      sinon.assert.calledOnce(func);
    });
  });

  describe('rendererExists', function () {
    const fn = lib[this.title];

    it('grabs a renderer if it exists', function () {
      expect(fn('html')).to.not.be.undefined;
    });

    it('returns false if renderer does not exist', function () {
      lib.registerRenderers({});
      expect(fn('html')).to.be.false;
    });
  });
});
