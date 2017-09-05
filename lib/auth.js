'use strict';
const _ = require('lodash'),
  passport = require('passport'),
  users = require('./services/users'),
  db = require('./services/db'),
  references = require('./services/references'),
  session = require('express-session'),
  flash = require('express-flash'),
  responses = require('./responses'),
  handlebars = require('handlebars'),
  basicAuth = require('basic-auth'),
  fs = require('fs'),
  path = require('path'),
  AUTH_LEVELS_MAP = {
    ADMIN: 'admin',
    WRITE: 'write'
  };

/**
 * Check the auth level to see if a user
 * has sufficient permissions
 *
 * @param  {String} userLevel
 * @param  {String} requiredLevel
 * @return {Boolean}
 */
function checkAuthLevel(userLevel, requiredLevel) {
  // User has to have an auth level set
  if (!userLevel) {
    throw new Error('User does not have an authentication level set');
  }

  if (userLevel === AUTH_LEVELS_MAP.ADMIN) {
    return true;
  } else if (userLevel !== requiredLevel) {
    return false;
  } else {
    return true;
  }
}

/**
 * Get the user auth level and check it against the
 * required auth level for a route. Send an error
 * if the user doesn't have permissions
 *
 * @param  {String} requiredLevel
 * @return {Function}
 */
function withAuthLevel(requiredLevel) {
  return function (req, res, next) {
    if (checkAuthLevel(_.get(req, 'user.auth', ''), requiredLevel)) {
      // If the user exists and meets the level requirement, let the request proceed
      next();
    } else {
      // None of the above, we need to error
      responses.unauthorized(res);
    }
  };
}

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
 * get the proper /auth url for a site
 * note: needs to add/not add initial slash, depending on the site path
 * @param {object} site
 * @returns {string}
 */
function getAuthUrl(site) {
  var base = references.uriToUrl(site.prefix, null, site.port);

  return _.last(base) === '/' ? `${base}auth` : `${base}/auth`;
}

/**
 * get the proper site path for redirects
 * note: this is needed because some sites have emptystring paths
 * @param {object} site
 * @returns {string}
 */
function getPathOrBase(site) {
  return site.path || '/';
}

/**
 * protect routes
 * @param {object} site
 * @returns {Function}
 */
function isAuthenticated(site) {
  return function (req, res, next) {
    if (req.isAuthenticated()) {
      next(); // already logged in
    } else if (req.get('Authorization')) {
      // try to authenticate with api key
      passport.authenticate('apikey', { session: false})(req, res, next);
    } else {
      req.session.returnTo = req.originalUrl; // redirect to this page after logging in
      // otherwise redirect to login
      res.redirect(`${getAuthUrl(site)}/login`);
    }
  };
};

/**
 * get callback url for a site
 * @param {object} site
 * @param {string} provider
 * @returns {string}
 */
function getCallbackUrl(site, provider) {
  return `${getAuthUrl(site)}/${provider}/callback`;
}

// serialize and deserialize users into the session
// note: pull user data from the database,
// so requests in the same session will get updated user data
function serializeUser(user, done) {
  done(null, users.encode(user.username.toLowerCase(), user.provider));
}

function deserializeUser(uid, done) {
  return db.get(`/users/${uid}`)
    .then(JSON.parse)
    .then(function (user) {
      done(null, user);
    })
    .catch(function (e) {
      done(e);
    });
}

passport.serializeUser(serializeUser);
passport.deserializeUser(deserializeUser);

/**
 * create/authenticate against a clay user
 * @param {object} properties to grab from provider and provider name itself
 * @param {object} site
 * @returns {Promise}
 */
function verify(properties) {
  return function (req, token, tokenSecret, profile, done) { // eslint-disable-line
    var username = _.get(profile, properties.username),
      imageUrl = _.get(profile, properties.imageUrl),
      name = _.get(profile, properties.name),
      provider = properties.provider,
      uid;

    if (!username) {
      throw new Error('Provider hasn\'t given a username at ' + properties.username);
    }

    // get UID
    uid = `/users/${users.encode(`${username.toLowerCase()}`, provider)}`;

    if (!req.user) {
      // first time logging in! update the user data
      return db.get(uid)
        .then(JSON.parse)
        .then(function (data) {
          // only update the user data if the property doesn't exist (name might have been changed through the kiln UI)
          return _.defaults(data, {
            imageUrl: imageUrl,
            name: name
          });
        })
        .then(function (data) {
          return db.put(uid, JSON.stringify(data))
            .then(() => done(null, data))
            .catch(e => done(e));
        })
        .catch(() => done(null, false, { message: 'User not found!' })); // no user found
    } else {
      // already authenticated. just grab the user data
      return db.get(uid)
        .then(JSON.parse)
        .then((data) => done(null, data))
        .catch(() => done(null, false, { message: 'User not found!' })); // no user found
    }
  };
}

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
  verify({
    username: 'username',
    imageUrl: 'photos[0].value',
    name: 'displayName',
    provider: 'twitter'
  }, site)));
}

/**
 * google auth strategy
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
  verify({
    username: 'emails[0].value',
    imageUrl: 'photos[0].value',
    name: 'displayName',
    provider: 'google'
  }, site)));
}

/**
 * slack auth strategy
 * @param {object} site
 */
function createSlackStrategy(site) {
  const SlackStrategy = require('passport-slack').Strategy;

  passport.use(`slack-${site.slug}`, new SlackStrategy({
    clientID: process.env.SLACK_CONSUMER_KEY,
    clientSecret: process.env.SLACK_CONSUMER_SECRET,
    callbackURL: getCallbackUrl(site, 'slack'),
    passReqToCallback: true,
    scope: 'users:read'
  },
  verify({
    username: '_json.user',
    imageUrl: '_json.info.user.profile.image_1024',
    name: '_json.info.user.real_name',
    provider: 'slack'
  }, site)));
}

/**
 * verify LDAP auth a little differently
 * note: this basically wraps verify with a different function signature
 * @param {object} site
 * @returns {function}
 */
function verifyLdap(site) {
  return function (req, user, done) {
    // the callback for LDAP is different than oauth, so we need to
    // pass different options to verify()
    module.exports.verify({ // allows this to be mocked in tests
      username: 'sAMAccountName',
      imageUrl: '', // ldap generally has no images
      name: 'displayName',
      provider: 'ldap'
    }, site)(req, null, null, user, done); // eslint-disable-line
  };
}

/**
 * ldap / active directory auth strategy
 * @param {object} site
 */
function createLDAPStrategy(site) {
  const LDAPStrategy = require('passport-ldapauth');

  passport.use(`ldap-${site.slug}`, new LDAPStrategy({
    server: {
      url: process.env.LDAP_URL,
      adminDn: process.env.LDAP_BIND_DN,
      adminPassword: process.env.LDAP_BIND_CREDENTIALS,
      searchBase: process.env.LDAP_SEARCH_BASE,
      searchFilter: process.env.LDAP_SEARCH_FILTER
    },
    passReqToCallback: true,
    credentialsLookup: basicAuth,
  }, verifyLdap(site)));
}

/**
 * api key callback, checks to see if api key provided matches env variable
 * @param {string} apikey
 * @param {function} done
 */
function apiCallback(apikey, done) {
  if (apikey === process.env.CLAY_ACCESS_KEY) {
    // If we're using an API Key then we're assuming the user is
    // has admin privileges by defining the auth level in the next line
    done(null, { provider: 'apikey', auth: 'admin' });
  } else {
    done(null, false, { message: 'Unknown apikey: ' + apikey });
  }
}

/**
 * api key strategy
 * matches against the CLAY_ACCESS_KEY env variable
 * @param {object} site
 */
function createAPIKeyStrategy() {
  const APIKeyStrategy = require('passport-http-header-token').Strategy;

  passport.use('apikey', new APIKeyStrategy({}, apiCallback));
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
        // twitter requires TWITTER_CONSUMER_KEY and TWITTER_CONSUMER_SECRET env variables
        break;
      case 'google': createGoogleStrategy(site);
        // google requires GOOGLE_CONSUMER_KEY and GOOGLE_CONSUMER_SECRET
        break;
      case 'slack': createSlackStrategy(site);
        // slack requires SLACK_CONSUMER_KEY and SLACK_CONSUMER_SECRET
        break;
      case 'ldap': createLDAPStrategy(site);
        // ldap requires LDAP_URL, LDAP_BIND_DN, LDAP_BIND_CREDENTIALS, LDAP_SEARCH_BASE, and LDAP_SEARCH_FILTER
        break;
      case 'apikey': createAPIKeyStrategy();
        // apikey requires CLAY_ACCESS_KEY
        break;
      default: throw new Error(`Unknown provider: ${provider}!`);
    }
  };
}

/**
 * when LDAP auth fails, ask for username + password natively
 * @param {object} res
 */
function rejectBasicAuth(res) {
  res.statusCode = 401;
  res.setHeader('WWW-Authenticate', 'Basic');
  res.end('Access denied');
}

/**
 * check credentials, ask for login prompt if they don't exist
 * @param {object} req
 * @param {object} res
 * @param {function} next
 * @returns {function} if no credentials
 */
function checkCredentials(req, res, next) {
  var credentials = basicAuth(req);

  if (!credentials) {
    // show native login prompt if user hasn't sent credentials
    return rejectBasicAuth(res);
  } else {
    // authenticate those credentials against ldap
    next();
  }
}

/**
 * add authorization routes to the router
 * @param {express.Router} router
 * @param {object} site
 * @returns {Function}
 */
function addAuthRoutes(router, site) {
  return function (provider) {
    // note: always call apikey auth first
    if (provider === 'google') {
      // google needs to send a special scope argument
      router.get(`/auth/${provider}`, passport.authenticate(`${provider}-${site.slug}`, { scope: [
        'https://www.googleapis.com/auth/userinfo.profile',
        'https://www.googleapis.com/auth/userinfo.email'
      ] }));
    } else if (provider === 'ldap') {
      router.get(`/auth/${provider}`, checkCredentials, passport.authenticate(`${provider}-${site.slug}`, {
        // passport options
        failureRedirect: `${getAuthUrl(site)}/login`,
        failureFlash: true,
        successReturnToOrRedirect: getPathOrBase(site) }));
    } else {
      router.get(`/auth/${provider}`, passport.authenticate(`${provider}-${site.slug}`));
    }

    if (provider !== 'ldap') {
      // ldap handles everything in /auth/ldap and doesn't use the callback at all
      router.get(`/auth/${provider}/callback`, passport.authenticate(`${provider}-${site.slug}`, {
        failureRedirect: `${getAuthUrl(site)}/login`,
        failureFlash: true,
        successReturnToOrRedirect: getPathOrBase(site) })); // redirect to previous page or site root
    }
  };
}

/**
 * compile a handlebars template
 * @param {string} filename
 * @returns {function}
 */
function compileTemplate(filename) {
  return handlebars.compile(fs.readFileSync(path.resolve(__dirname, '..', 'views', filename), { encoding: 'utf-8' }));
}

/**
 * the actual middleware that protects our routes, plz no hax
 * @param {object} site
 * @returns {function}
 */
function protectRoutes(site) {
  return function (req, res, next) {
    if (module.exports.isProtectedRoute(req)) { // allow mocking of these for testing
      module.exports.isAuthenticated(site)(req, res, next);
    } else {
      next();
    }
  };
}

/**
 * middleware to show login page
 * @param {function} tpl
 * @param {object} site
 * @param {array} currentProviders
 * @returns {function}
 */
function onLogin(tpl, site, currentProviders) {
  return function (req, res) {
    var flash = req.flash();

    if (flash && _.includes(flash.error, 'Invalid username/password')) {
      res.statusCode = 401;
      res.setHeader('WWW-Authenticate', 'Basic realm="Incorrect Credentials"');
      res.end('Access denied');
      // this will prompt users one more time for the correct password,
      // then display the login page WITHOUT saving the basic auth credentials.
      // if they hit login, it'll show the auth form again, but won't show it a
      // second time if they enter the wrong info.
      // note: if the user enters the correct info on the second form,
      // it'll show the login page but they'll have to click login again
      // (and it'll automatically log them in without having to re-enter credentials)
      // note: all of the above is the default behavior in amphora, but we're
      // going to use varnish to automatically redirect them back to the ldap auth
    } else {
      res.send(tpl({
        path: getPathOrBase(site),
        flash: flash,
        currentProviders: currentProviders,
        user: req.user,
        logoutLink: `${getAuthUrl(site)}/logout`
      }));
    }
  };
}

/**
 * middleware to log out. redirects to login page
 * note: it goes to login page because usually users are navigating from edit mode,
 * and they can't be redirected back into edit mode without logging in
 * @param {object} site
 * @returns {function}
 */
function onLogout(site) {
  return function (req, res) {
    req.logout();
    res.redirect(`${getAuthUrl(site)}/login`);
  };
}

/**
 * There exists a case in which a user has an active session and
 * is then removed as a user from a Clay instance. We must handle
 * the error by re-directing the user to the login page and logging
 * them out of their current session
 *
 * @param  {Object} site
 */
function checkAuthentication(site) {
  return function (err, req, res, next) {
    if (err) {
      onLogout(site)(req, res);
    } else {
      next();
    }
  }
}

/**
 * initialize authentication
 * @param {express.Router} router
 * @param {array} providers (may be empty array)
 * @param {object} site config for the site
 * @param {object} [sessionStore]
 * @returns {array}
 */
function init(router, providers, site, sessionStore) {
  const tpl = compileTemplate('login.handlebars'),
    icons = ['clay-logo', 'twitter', 'google', 'slack', 'ldap', 'logout'],
    currentProviders = _.map(_.reject(providers, (provider) => provider === 'apikey'), function (provider) {
      return {
        name: provider,
        url: `${getAuthUrl(site)}/${provider}`,
        title: `Log in with ${_.capitalize(provider)}`,
        icon: _.constant(provider) // a function that returns the provider
      };
    });

  if (_.isEmpty(providers)) {
    return []; // exit early if no providers are passed in
  }

  // add svgs to handlebars
  _.each(icons, function (icon) {
    handlebars.registerPartial(icon, compileTemplate(`${icon}.svg`));
  });

  _.each(providers, module.exports.createStrategy(site)); // allow mocking this in tests

  // init session authentication
  router.use(session({
    secret: 'clay',
    resave: false, // please use a session store (like connect-redis) that supports .touch()
    saveUninitialized: false,
    rolling: true,
    name: 'clay-session',
    cookie: {
      maxAge: 1000 * 60 * 60 * 24 * 7 // 1 week
    },
    store: sessionStore
  }));
  router.use(passport.initialize());
  router.use(passport.session());
  router.use(flash());

  // protect routes
  router.use(protectRoutes(site));



  // add authorization routes
  // note: these (and the provider routes) are added here,
  // rather than as route controllers in lib/routes/
  router.get('/auth/login', onLogin(tpl, site, currentProviders));
  router.get('/auth/logout', onLogout(site));
  _.each(providers, module.exports.addAuthRoutes(router, site)); // allow mocking this in tests

  // handle de-authentication errors. This occurs when a user is logged in
  // and someone removes them as a user. We need to catch the error
  router.use(checkAuthentication(site));

  return currentProviders; // for testing/verification
}

module.exports.init = init;
module.exports.withAuthLevel = withAuthLevel;
module.exports.authLevels = AUTH_LEVELS_MAP;

// for testing
module.exports.isProtectedRoute = isProtectedRoute;
module.exports.isAuthenticated = isAuthenticated;
module.exports.getCallbackUrl = getCallbackUrl;
module.exports.getPathOrBase = getPathOrBase;
module.exports.verify = verify;
module.exports.verifyLdap = verifyLdap;
module.exports.apiCallback = apiCallback;
module.exports.createStrategy = createStrategy;
module.exports.rejectBasicAuth = rejectBasicAuth;
module.exports.checkCredentials = checkCredentials;
module.exports.addAuthRoutes = addAuthRoutes;
module.exports.protectRoutes = protectRoutes;
module.exports.checkAuthentication = checkAuthentication;
module.exports.serializeUser = serializeUser;
module.exports.deserializeUser = deserializeUser;
module.exports.onLogin = onLogin;
module.exports.onLogout = onLogout;
