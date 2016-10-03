'use strict';
const _ = require('lodash'),
  passport = require('passport'),
  users = require('./services/users'),
  db = require('./services/db'),
  references = require('./services/references');

function createTwitterStrategy(site) {
  const TwitterStrategy = require('passport-twitter').Strategy;

  passport.use(new TwitterStrategy({
    consumerKey: TWITTER_CONSUMER_KEY,
    consumerSecret: TWITTER_CONSUMER_SECRET,
    callbackURL: `${references.uriToUrl(site.prefix, null, site.port)}/auth/twitter/callback`
  },
  function (token, tokenSecret, profile, done) {
    db.get(site.prefix + users.encode(`${profile.id}@twitter`))
      .then(data => done(null, data))
      .catch(e => done(e));
  }));
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
 * initialize authentication
 * @param {express.Router} router
 * @param {array} providers (may be empty array)
 * @param {object} site config for the site
 */
function init(router, providers, site) {
  _.each(providers, createStrategy(site));

  if (providers.length) {
    router.use(express.session({ secret: 'clay'}));
    router.use(passport.initialize());
    router.use(passport.session());
  }
}

module.exports = init;
