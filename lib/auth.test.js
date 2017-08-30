'use strict';

const filename = __filename.split('/').pop().split('.').shift(),
  lib = require('./auth'),
  _ = require('lodash'),
  expect = require('chai').expect,
  sinon = require('sinon'),
  passport = require('passport'),
  winston = require('winston'),
  sites = require('./services/sites'),
  passportTwitter = require('passport-twitter'),
  passportGoogle = require('passport-google-oauth'),
  passportSlack = require('passport-slack'),
  passportAPIKey = require('passport-http-header-token'),
  db = require('./services/db');

describe(_.startCase(filename), function () {
  let sandbox;

  beforeEach(function () {
    sandbox = sinon.sandbox.create();
    sandbox.stub(winston);
    sandbox.stub(passport, 'authenticate', () => (req, res, next) => next());
    sandbox.stub(passport, 'use');
    sandbox.stub(passportTwitter, 'Strategy');
    sandbox.stub(passportGoogle, 'OAuth2Strategy');
    sandbox.stub(passportSlack, 'Strategy');
    // ldap is called directly, so we can't stub it
    sandbox.stub(passportAPIKey, 'Strategy');
    sandbox.stub(sites);
    sandbox.stub(db);
  });

  afterEach(function () {
    sandbox.restore();
  });

  describe('isProtectedRoute', function () {
    const fn = lib[this.title];

    it('is true if edit mode', function () {
      expect(fn({ query: { edit: true }})).to.equal(true);
    });

    it('is true if POST to api', function () {
      expect(fn({ query: {}, method: 'POST' })).to.equal(true);
    });

    it('is true if PUT to api', function () {
      expect(fn({ query: {}, method: 'PUT' })).to.equal(true);
    });

    it('is true if DELETE to api', function () {
      expect(fn({ query: {}, method: 'DELETE' })).to.equal(true);
    });

    it('is false if GET to api (or non-edit page)', function () {
      expect(fn({ query: {}, method: 'GET' })).to.equal(false);
    });
  });

  describe('isAuthenticated', function () {
    const fn = lib[this.title];

    it('passes through if authenticated (through session, etc)', function (done) {
      fn()({ isAuthenticated: () => true }, null, done);
    });

    it('calls apikey auth if Authorization header is sent', function (done) {
      fn()({ isAuthenticated: () => false, get: () => true }, null, function () {
        expect(passport.authenticate.callCount).to.equal(1);
        done();
      });
    });

    it('sets return url and redirects to login page if not authenticated', function () {
      var req = {
          isAuthenticated: () => false,
          get: () => false,
          originalUrl: 'domain.com',
          session: {}
        },
        res = {
          redirect: sandbox.spy()
        };

      sites.getSiteFromPrefix.returns({ host: 'domain.com', prefix: 'domain.com' });
      fn({ path: '/' })(req, res); // never calls next(), but checks synchronously
      expect(req.session.returnTo).to.equal(req.originalUrl);
      expect(res.redirect.callCount).to.equal(1);
    });

    it('falls back to default site if site service returns undefined', function () {
      var req = {
          isAuthenticated: () => false,
          get: () => false,
          originalUrl: 'domain.com',
          session: {}
        },
        res = {
          redirect: sandbox.spy()
        };

      sites.getSiteFromPrefix.returns(undefined);
      fn({ path: '/' })(req, res); // never calls next(), but checks synchronously
      expect(req.session.returnTo).to.equal(req.originalUrl);
      expect(res.redirect.callCount).to.equal(1);
    });
  });

  describe('getCallbackUrl', function () {
    const fn = lib[this.title];

    it('adds initial slash (after the site path) if site has a path', function () {
      expect(fn({ path: '/foo', prefix: 'domain.com/foo', port: '80'}, 'twitter')).to.equal('http://domain.com/foo/auth/twitter/callback');
    });

    it('does not add slash if site has no path', function () {
      expect(fn({ prefix: 'domain.com/', port: '80'}, 'twitter')).to.equal('http://domain.com/auth/twitter/callback');
    });
  });

  describe('getPathOrBase', function () {
    const fn = lib[this.title];

    it('adds initial slash if site path is emptystring', function () {
      expect(fn({ path: '' })).to.equal('/');
    });

    it('does not add slash if site path exists', function () {
      expect(fn({ path: '/foo'})).to.equal('/foo');
    });
  });

  describe('returnUser', function () {
    const fn = lib[this.title];

    it('returns whatever is passed to it', function (done) {
      fn('hi', function (err, data) {
        expect(err).to.equal(null);
        expect(data).to.equal('hi');
        done();
      });
    });
  });

  describe('verify', function () {
    const fn = lib[this.title],
      siteStub = {
        prefix: 'domain.com/'
      },
      properties = {
        username: 'username',
        imageUrl: 'imageUrl',
        name: 'name',
        provider: 'twitter'
      },
      profile = {
        username: 'foobar',
        imageUrl: 'http://domain.com/image.jpg',
        name: 'Foo Bar'
      },
      userData = {
        imageUrl: 'http://domain.com/image.jpg',
        name: 'Foo Bar'
      },
      notFoundMessage = 'User not found!',
      expectNotFound = function (done) {
        return function (err, data, status) {
          expect(err).to.equal(null);
          expect(data).to.equal(false);
          expect(status.message).to.equal(notFoundMessage);
          done();
        };
      },
      expectError = function (done) {
        return function (err) {
          expect(err.message).to.equal('some db error');
          done();
        };
      },
      expectData = function (done) {
        return function (err, data) {
          expect(err).to.equal(null);
          expect(data).to.deep.equal(userData);
          // note: ignoring username + provider because we're solely testing
          // the profile import. username + provider are pre-provisioned on the
          // initial user POST
          done();
        };
      };

    it('throws if provider\'s username is falsy', function () {
      function result() {
        return fn(properties, siteStub)({ user: false }, null, null, { username: null }, _.noop);
      }

      expect(result).to.throw(Error);
    });

    it('errors if user not found on initial auth', function (done) {
      db.get.returns(Promise.reject());

      fn(properties, siteStub)({ user: false }, null, null, profile, expectNotFound(done));
    });

    it('errors if user PUT fails on initial auth', function (done) {
      db.get.returns(Promise.resolve(JSON.stringify({})));
      db.put.returns(Promise.reject(new Error('some db error')));

      fn(properties, siteStub)({ user: false }, null, null, profile, expectError(done));
    });

    it('assigns name and image if user found on initial auth', function (done) {
      db.get.returns(Promise.resolve(JSON.stringify({})));
      db.put.returns(Promise.resolve());

      fn(properties, siteStub)({ user: false }, null, null, profile, expectData(done));
    });

    it('errors if user not found on subsequent auth', function (done) {
      db.get.returns(Promise.reject());

      fn(properties, siteStub)({ user: true }, null, null, profile, expectNotFound(done));
    });

    it('grabs user data if user found on subsequent auth', function (done) {
      db.get.returns(Promise.resolve(JSON.stringify(userData)));

      fn(properties, siteStub)({ user: true }, null, null, profile, expectData(done));
    });
  });

  describe('verifyLdap', function () {
    const fn = lib[this.title];

    it('calls verify with a slightly different function signature', function (done) {
      sandbox.stub(lib, 'verify', () => (req, token, tokenSecret, profile, cb) => cb()); // eslint-disable-line

      fn({})({}, {}, function () {
        expect(lib.verify.called).to.equal(true);
        done();
      });
    });
  });

  describe('apiCallback', function () {
    const fn = lib[this.title];

    it('allows api key that matches CLAY_ACCESS_KEY', function (done) {
      var oldKey = process.env.CLAY_ACCESS_KEY;

      process.env.CLAY_ACCESS_KEY = '123';
      fn('123', function (err, data) {
        expect(err).to.equal(null);
        expect(data).to.deep.equal({ provider: 'apikey' });
        process.env.CLAY_ACCESS_KEY = oldKey;
        done();
      });
    });

    it('disallows api key that does not match CLAY_ACCESS_KEY', function (done) {
      var oldKey = process.env.CLAY_ACCESS_KEY;

      process.env.CLAY_ACCESS_KEY = '123';
      fn('456', function (err, data, status) {
        expect(err).to.equal(null);
        expect(data).to.equal(false);
        expect(status.message).to.equal('Unknown apikey: 456');
        process.env.CLAY_ACCESS_KEY = oldKey;
        done();
      });
    });
  });

  describe('createStrategy', function () {
    const fn = lib[this.title],
      siteStub = {
        slug: 'foo'
      };

    it('creates twitter strategy', function () {
      fn(siteStub)('twitter');
      expect(passport.use.calledWith('twitter-foo')).to.equal(true);
    });

    it('creates google strategy', function () {
      fn(siteStub)('google');
      expect(passport.use.calledWith('google-foo')).to.equal(true);
    });

    it('creates slack strategy', function () {
      fn(siteStub)('slack');
      expect(passport.use.calledWith('slack-foo')).to.equal(true);
    });

    it('creates ldap strategy', function () {
      fn(siteStub)('ldap');
      expect(passport.use.calledWith('ldap-foo')).to.equal(true);
    });

    it('creates apikey strategy', function () {
      fn(siteStub)('apikey');
      expect(passport.use.calledWith('apikey')).to.equal(true); // no site
    });

    it('throws error when passed an unsupported strategy', function () {
      function result() {
        fn(siteStub)('not-supported');
      }

      expect(result).to.throw('Unknown provider: not-supported!');
    });
  });

  describe('rejectBasicAuth', function () {
    const fn = lib[this.title];

    it('sets status code to 401', function () {
      var res = { setHeader: _.noop, end: _.noop };

      fn(res);
      expect(res.statusCode).to.equal(401);
    });

    it('sets authentication header', function () {
      var res = { setHeader: sandbox.spy(), end: _.noop };

      fn(res);
      expect(res.setHeader.calledWith('WWW-Authenticate')).to.equal(true);
    });

    it('calls res.end()', function () {
      var res = { setHeader: _.noop, end: sandbox.spy() };

      fn(res);
      expect(res.end.calledWith('Access denied')).to.equal(true);
    });
  });

  describe('checkCredentials', function () {
    const fn = lib[this.title];

    it('rejects synchronously if no credentials found', function () {
      var res = { setHeader: _.noop, end: sandbox.spy() };

      fn({ headers: {}}, res, _.noop);
      expect(res.end.called).to.equal(true);
    });

    function request(authorization) {
      return {
        headers: {
          authorization: authorization
        }
      };
    }

    it('passes through if credentials exist', function (done) {
      var req = request('basic Zm9vOmJhcg==');

      fn(req, {}, done); // expect done to be called
    });
  });

  describe('addAuthRoutes', function () {
    const fn = lib[this.title],
      paths = [],
      router = {
        get: function (path) {
          // testing if the paths are added,
          // we're checking the paths array after each test
          paths.push(path);
        }
      };

    it('adds google auth and callback routes', function () {
      fn(router, {})('google');
      expect(_.includes(paths, '/auth/google')).to.equal(true);
      expect(_.includes(paths, '/auth/google/callback')).to.equal(true);
    });

    it('adds twitter auth and callback routes', function () {
      fn(router, {})('twitter');
      expect(_.includes(paths, '/auth/twitter')).to.equal(true);
      expect(_.includes(paths, '/auth/twitter/callback')).to.equal(true);
    });

    it('adds slack auth and callback routes', function () {
      fn(router, {})('slack');
      expect(_.includes(paths, '/auth/slack')).to.equal(true);
      expect(_.includes(paths, '/auth/slack/callback')).to.equal(true);
    });

    it('adds ldap auth route', function () {
      fn(router, {})('ldap');
      expect(_.includes(paths, '/auth/ldap')).to.equal(true);
    });
  });

  describe('init', function () {
    const fn = lib[this.title];

    it('does nothing if no providers are enabled', function () {
      expect(fn({}, [], { path: '/' })).to.deep.equal([]);
    });

    it('does not display apikey in the provider list', function () {
      var router = {
          use: _.noop,
          get: _.noop
        },
        result;

      // we're testing these elsewhere
      sandbox.stub(lib, 'createStrategy');
      sandbox.stub(lib, 'addAuthRoutes');

      // call init!
      result = fn(router, ['apikey', 'twitter', 'google', 'slack', 'ldap'], { path: '' });

      // now test it
      expect(result.map((item) => item.name)).to.deep.equal(['twitter', 'google', 'slack', 'ldap']);
    });

    it('mounts session stuff to router', function () {
      var router = {
        use: sandbox.spy(),
        get: sandbox.spy()
      };

      // we're testing these elsewhere
      sandbox.stub(lib, 'createStrategy');
      sandbox.stub(lib, 'addAuthRoutes');

      fn(router, ['apikey', 'twitter', 'google', 'slack', 'ldap'], { path: '' });
      expect(router.use.callCount).to.equal(5);
    });

    it('mounts login/logout to router', function () {
      var router = {
        use: sandbox.spy(),
        get: sandbox.spy()
      };

      // we're testing these elsewhere
      sandbox.stub(lib, 'createStrategy');
      sandbox.stub(lib, 'addAuthRoutes');

      fn(router, ['apikey', 'twitter', 'google', 'slack', 'ldap'], { path: '' });
      expect(router.get.callCount).to.equal(2);
    });
  });

  describe('protectRoutes', function () {
    const fn = lib[this.title];

    it('authenticates against protected routes', function (done) {
      sandbox.stub(lib, 'isProtectedRoute').returns(true);
      sandbox.stub(lib, 'isAuthenticated').returns((req, res, next) => next());

      fn({})({}, {}, function () {
        expect(lib.isAuthenticated.called).to.equal(true);
        done();
      });
    });

    it('passes through unprotected routes', function (done) {
      sandbox.stub(lib, 'isProtectedRoute').returns(false);
      sandbox.stub(lib, 'isAuthenticated');

      fn({})({}, {}, function () {
        expect(lib.isAuthenticated.called).to.equal(false);
        done();
      });
    });
  });

  describe('onLogin', function () {
    const fn = lib[this.title];

    it('shows the login page if there are no errors', function () {
      var tpl = sandbox.spy();

      fn(tpl, { path: '' }, [])({ flash: _.noop }, { send: _.noop });
      expect(tpl.called).to.equal(true);
    });

    it('forcibly clears http credentials if there is a credential error', function () {
      var tpl = sandbox.spy();

      fn(tpl, { path: '' }, [])({ flash: function () { return { error: ['Invalid username/password'] }; } }, { setHeader: _.noop, send: _.noop, end: _.noop });
      expect(tpl.called).to.equal(false);
    });
  });

  describe('onLogout', function () {
    const fn = lib[this.title];

    it('logs out the user', function () {
      var req = { logout: sandbox.spy() };

      fn({ path: '' })(req, { redirect: _.noop });
      expect(req.logout.called).to.equal(true);
    });

    it('redirects to the login page', function () {
      var res = { redirect: sandbox.spy() };

      fn({ prefix: 'domain.com' })({ logout: _.noop }, res);
      expect(res.redirect.calledWith('http://domain.com/auth/login')).to.equal(true);
    });
  });
});
