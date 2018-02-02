'use strict';

const _ = require('lodash'),
  bluebird = require('bluebird'),
  filename = __filename.split('/').pop().split('.').shift(),
  db = require('./services/db'),
  lib = require('./' + filename),
  expect = require('chai').expect,
  sinon = require('sinon'),
  winston = require('winston'),
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
      _data: {},
      _media: {
        styles: [],
        scripts: []
      }
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

  function expectNoLogging() {
    sinon.assert.notCalled(winston.log);
    sinon.assert.notCalled(winston.info);
    sinon.assert.notCalled(winston.warn);
    sinon.assert.notCalled(winston.error);
  }

  beforeEach(function () {
    sandbox = sinon.sandbox.create();

    sandbox.stub(db);
    sandbox.stub(winston);
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

    it('sends out the output of the render', function (done) {
      const res = getMockRes(function () { done(); });

      sandbox.stub(lib, 'renderUri').returns(Promise.resolve({type: 'html', output: 'some html'}));

      lib(res.req, res, _.noop)
        .then(function () {
          sinon.assert.calledOnce(res.send);
          sinon.assert.calledOnce(res.type);
        });
    });

    it('does not send anything if the renderer resolves no data', function (done) {
      const res = getMockRes();

      sandbox.stub(lib, 'renderUri').returns(Promise.resolve());

      lib(res.req, res, _.noop)
        .then(function () {
          expect(res.send.calledOnce).to.be.false;
          done();
        });
    });

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

      // THIS IS WHAT WE EXPECT FROM THE BASIC PROCESS:

      // 1. look up page
      db.get.returns(resolveString({layout: '/_components/hey'}));

      // 2. get the data that will be composed in the template
      components.get.returns(bluebird.resolve({}));

      // 3. get the template that will be composed
      components.getTemplate.returns('asdf');

      // 4. rendering should happen (they should NOT try to send this on their own)
      // 5. log success

      return fn('/_pages/whatever', req, res).then(function () {
        sinon.assert.callCount(db.get, 1);
        sinon.assert.callCount(components.get, 1);
        sinon.assert.callCount(res.send, 0);
        expectNoLogging();
      });
    });
  });

  describe('renderComponent', function () {
    const fn = lib[this.title];

    it('throws if data not found, no logging', function (done) {
      var req = getMockReq();

      components.get.returns(bluebird.reject(new Error('thing')));

      fn(req, getMockRes()).then(done.bind(null, 'should throw'), function () {
        // should not fetch template if there is no data, that would be a waste
        sinon.assert.callCount(components.getTemplate, 0);

        // should attempt to fetch the data, for sure.
        sinon.assert.callCount(components.get, 1);

        expectNoLogging();
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
      components.getTemplate.returns('some/path');
      components.get.returns(bluebird.resolve({site: mockSite}));
      composer.resolveComponentReferences.returns(Promise.resolve(mockResolver()));

      return fn(getMockReq(), getMockRes(), {}).then(function () {
        expect(composer.resolveComponentReferences.calledOnce).to.be.true;
        expectNoLogging();
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
        expectNoLogging();
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
          expectNoLogging();
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

  describe('applyOptions', function () {
    const fn = lib[this.title];

    lib.registerEnv(['foo', 'bar']);

    it('consolidates all request information to be sent to the rendererer', function () {
      const locals = {
          site: {
            slug: 'site'
          }
        },
        callback = fn({}, locals);
      var returnVal;

      components.getIndices.returns({components: ['a', 'b', 'c']});
      returnVal = callback({});
      expect(returnVal._components).to.be.an.array;
      expect(returnVal._componentSchemas).to.be.an.array;
      expect(returnVal._media).to.have.property('styles');
      expect(returnVal._media).to.have.property('styles');
    });

    it('calls `resolveEnvVars` if the request is for edit mode', function () {
      const locals = {
          site: {
            slug: 'site'
          },
          edit: 'true'
        },
        callback = fn({}, locals),
        returnVal = callback({});

      sandbox.stub(lib, 'resolveEnvVars');
      expect(returnVal._envVars).to.eql({ foo: undefined, bar: undefined });
    });
  });



  describe('transfer', function () {
    const fn = lib[this.title];

    it('transfers value and property to a new object', function () {
      const from = { a: true },
        to = {};

      fn(from, to, 'a');

      expect(to.a).to.be.true;
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
