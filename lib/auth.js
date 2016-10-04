'use strict';
const _ = require('lodash'),
  passport = require('passport'),
  users = require('./services/users'),
  db = require('./services/db'),
  references = require('./services/references'),
  session = require('express-session');

/**
 * determine if a route is protected
 * protected routes are ?edit=true and any method other than GET
 * @param {object} req
 * @returns {boolean}
 */
function isProtectedRoute(req) {
  return !!req.query.edit || req.method !== 'GET';
}

/**
 * protect routes
 * @param {object} site
 * @returns {Function}
 */
function isAuthenticated(site) {
  return function (req, res, next) {
    if (req.isAuthenticated()) {
      next();
    } else {
      req.session.returnTo = req.originalUrl; // redirect to this page after logging in
      res.redirect(`${site.path}/auth/login`);
    }
  };
};

/**
 * get callback url for a site
 * note: needs to add/not add initial slash, depending on the site path
 * @param {object} site
 * @param {string} provider
 * @returns {string}
 */
function getCallbackUrl(site, provider) {
  return site.path ?
    `${references.uriToUrl(site.prefix, null, site.port)}/auth/${provider}/callback` :
    `${references.uriToUrl(site.prefix, null, site.port)}auth/${provider}/callback`;
}

// serialize and deserialize users into the session
passport.serializeUser((user, done) => done(null, user));
passport.deserializeUser((user, done) => done(null, user));

/**
 * twitter auth strategy
 * @param {object} site
 */
function createTwitterStrategy(site) {
  const TwitterStrategy = require('passport-twitter').Strategy;

  passport.use(`twitter-${site.slug}`, new TwitterStrategy({
    consumerKey: process.env.TWITTER_CONSUMER_KEY,
    consumerSecret: process.env.TWITTER_CONSUMER_SECRET,
    callbackURL: getCallbackUrl(site, 'twitter'),
    passReqToCallback: true
  },
  function (req, token, tokenSecret, profile, done) { // eslint-disable-line
    var uid = site.prefix + '/users/' + users.encode(`${profile.username.toLowerCase()}`, 'twitter');

    if (!req.user) {
      // first time logging in! update the user data
      return db.get(uid)
        .then(JSON.parse)
        .then(function (data) {
          return _.assign(data, {
            imageUrl: _.get(profile, 'photos[0].value'),
            name: profile.displayName
          });
        })
        .then(function (data) {
          return db.put(uid, JSON.stringify(data))
            .then(() => done(null, data))
            .catch(e => done(e));
        });
    } else {
      // already authenticated. just grab the user data
      return db.get(uid)
        .then(JSON.parse)
        .then((data) => done(null, data));
    }
  }));
}

/**
 * twitter auth strategy
 * @param {object} site
 */
function createGoogleStrategy(site) {
  const GoogleStrategy = require('passport-google-oauth').OAuth2Strategy;

  passport.use(`google-${site.slug}`, new GoogleStrategy({
    clientID: process.env.GOOGLE_CONSUMER_KEY,
    clientSecret: process.env.GOOGLE_CONSUMER_SECRET,
    callbackURL: getCallbackUrl(site, 'google'),
    passReqToCallback: true
  },
  function (req, token, tokenSecret, profile, done) { // eslint-disable-line
    var uid = site.prefix + '/users/' + users.encode(`${profile.username.toLowerCase()}`, 'google');

    console.log(profile)
    if (!req.user) {
      // first time logging in! update the user data
      return db.get(uid)
        .then(JSON.parse)
        .then(function (data) {
          return _.assign(data, {
            imageUrl: _.get(profile, 'photos[0].value'),
            name: profile.displayName
          });
        })
        .then(function (data) {
          return db.put(uid, JSON.stringify(data))
            .then(() => done(null, data))
            .catch(e => done(e));
        });
    } else {
      // already authenticated. just grab the user data
      return db.get(uid)
        .then(JSON.parse)
        .then((data) => done(null, data));
    }
  }));
}

function createSlackStrategy() {

}

/**
 * create the specified provider strategy
 * @param {object} site
 * @throws {Error} if unsupported strategy
 * @returns {Function}
 */
function createStrategy(site) {
  return function (provider) {
    switch (provider) {
      case 'twitter': createTwitterStrategy(site);
        break;
      case 'google': createGoogleStrategy(site);
        break;
      case 'slack': createSlackStrategy(site);
        break;
      default: throw new Error(`Unknown provider: ${provider}!`);
    }
  };
}

/**
 * add authorization routes to the router
 * @param {express.Router} router
 * @param {object} site
 * @returns {Function}
 */
function addAuthRoutes(router, site) {
  return function (provider) {
    router.get(`/auth/${provider}`, passport.authenticate(`${provider}-${site.slug}`));
    router.get(`/auth/${provider}/callback`, passport.authenticate(`${provider}-${site.slug}`, {
      failureRedirect: '/auth/login',
      successReturnToOrRedirect: site.path })); // redirect to previous page or site root
  };
}

/**
 * initialize authentication
 * @param {express.Router} router
 * @param {array} providers (may be empty array)
 * @param {object} site config for the site
 */
function init(router, providers, site) {
  _.each(providers, createStrategy(site));

  if (providers.length) {
    // init session authentication
    router.use(session({
      secret: 'clay',
      resave: false,
      saveUninitialized: false
    }));
    router.use(passport.initialize());
    router.use(passport.session());

    // protect routes
    router.use(function (req, res, next) {
      if (isProtectedRoute(req)) {
        isAuthenticated(site)(req, res, next);
      } else {
        next();
      }
    });

    // add authorization routes
    router.get('/auth/login', (req, res) => res.redirect(`${site.path}/auth/twitter`)); // todo: actual login page
    router.get('/auth/logout', function (req, res) {
      req.logout();
      res.redirect(site.path);
    });
    _.each(providers, addAuthRoutes(router, site));
  }
}

module.exports = init;
