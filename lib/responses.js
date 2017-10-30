'use strict';

const _ = require('lodash'),
  db = require('./services/db'),
  bluebird = require('bluebird'),
  filter = require('through2-filter'),
  map = require('through2-map'),
  references = require('./services/references'),
  highland = require('highland'),
  referencedProperty = '_ref';
var log = require('./services/log').setup({ file: __filename });

/**
 * Finds prefixToken, and removes it and anything before it.
 *
 * @param {string} str
 * @param {string} prefixToken
 * @returns {string}
 */
function removePrefix(str, prefixToken) {
  const index =  str.indexOf(prefixToken);

  if (index > -1) {
    str = str.substr(index + prefixToken.length).trim();
  }
  return str;
}

/**
 * Remove extension from route / path.
 * @param {string} path
 * @returns {string}
 */
function removeExtension(path) {
  let leadingDot, endSlash = path.lastIndexOf('/');

  if (endSlash > -1) {
    leadingDot = path.indexOf('.', endSlash);
  } else {
    leadingDot = path.indexOf('.');
  }

  if (leadingDot > -1) {
    path = path.substr(0, leadingDot);
  }
  return path;
}

/**
 * remove querystring from route / path.
 * @param  {string} path
 * @return {string}
 */
function removeQueryString(path) {
  return path.split('?')[0];
}

/**
 * @param {string} path
 * @returns {string}
 */
function normalizePath(path) {
  return removeExtension(removeQueryString(path));
}

/**
 * @param {object} req
 * @returns {string}
 */
function getUri(req) {
  return normalizePath(req.hostname + req.baseUrl + req.path);
}

/**
 * Send whatever is default for this type of data with this status code.
 * @param {number} code
 * @param {object} res
 * @returns {function}
 */
function sendDefaultErrorCode(code, res) {
  return function () {
    res.sendStatus(code);
  };
}

/**
 * Send some html (should probably be some default, or a render of a 500 page)
 * @param {number} code
 * @param {string} message
 * @param {object} res
 * @returns {function}
 */
function sendHTMLErrorCode(code, message, res) {
  return function () {
    res.type('html');
    res.send(code + ' ' + message);
  };
}

/**
 * @param {number} code
 * @param {string} message
 * @param {object} res
 * @param {object} extras
 * @returns {function}
 */
function sendJSONErrorCode(code, message, res, extras) {
  return function () {
    res.json(_.assign({ message, code }, extras));
  };
}

/**
 * @param {number} code
 * @param {string} message
 * @param {object} res
 * @returns {function}
 */
function sendTextErrorCode(code, message, res) {
  return function () {
    res.type('text');
    res.send(code + ' ' + message);
  };
}

/**
 * @param {number} code
 * @param {string} message
 * @param {object} res
 * @param {object} extras
 */
function sendDefaultResponseForCode(code, message, res, extras) {
  res.status(code).format({
    json: sendJSONErrorCode(code, message, res, extras),
    html: sendHTMLErrorCode(code, message, res),
    text: sendTextErrorCode(code, message, res),
    default: sendDefaultErrorCode(code, res)
  });
}

/**
 * This route is not implemented.
 * @param {object} req
 * @param {object} res
 */
function notImplemented(req, res) {
  const code = 501,
    message = 'Not Implemented';

  sendDefaultResponseForCode(code, message, res);
}

/**
 * This method not allowed
 * @param {{allow: [string]}} options
 * @returns {function}
 */
function methodNotAllowed(options) {
  const allowed = options.allow;

  return function (req, res, next) {
    let message, code,
      method = req.method;

    if (_.includes(allowed, method.toLowerCase())) {
      next();
    } else {
      code = 405;
      message = 'Method ' + method + ' not allowed';
      res.set('Allow', allowed.join(', ').toUpperCase());
      sendDefaultResponseForCode(code, message, res, options);
    }
  };
}

/**
 * This route not allowed
 * @param {{accept: [string]}} options
 * @returns {function}
 */
function notAcceptable(options) {
  const acceptableTypes = options.accept;

  return function (req, res, next) {
    let message, code,
      matchedType = req.accepts(acceptableTypes);

    if (matchedType) {
      next();
    } else {
      code = 406;
      message = req.get('Accept') + ' not acceptable';
      res.set('Accept', acceptableTypes.join(', ').toLowerCase());
      sendDefaultResponseForCode(code, message, res, options);
    }
  };
}

/**
 * @param {object} req
 * @param {object} res
 * @param {function} next
 */
function denyTrailingSlashOnId(req, res, next) {
  if (_.last(req.path) === '/') {
    sendDefaultResponseForCode(400, 'Trailing slash on RESTful id in URL is not acceptable', res);
  } else {
    next();
  }
}

/**
 * This route not allowed
 * @param {object} req
 * @param {object} res
 * @param {Function} next
 */
function denyReferenceAtRoot(req, res, next) {
  const body = req.body;

  if (_.has(body, '_ref')) {
    sendDefaultResponseForCode(400, 'Reference (_ref) at root of object is not acceptable', res);
  } else {
    next();
  }
}

/**
 * @param {{varyBy: [string]}} options
 * @returns {function}
 */
function varyWithoutExtension(options) {
  const varyBy = options.varyBy.join(', ');

  return function (req, res, next) {
    // a slash, followed by a dot, followed by more characters, means it is an extension
    // note that this is explicitly not talking about a uri; Law of Demeter
    if (!(req.baseUrl + req.url).match(/.*\/.*\.(.*)/)) {
      res.set('Vary', varyBy);
    }

    next();
  };
}

/**
 * @param {object} req
 * @param {object} res
 * @param {function} next
 */
function onlyCachePublished(req, res, next) {
  // if published, its perfectly cacheable (and it _should_ be cached).
  if (req.version === 'published') {
    res.set('Cache-Control', 'public');
  } else {
    // if not published, its not cacheable
    res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
  }
  next();
}

/**
 * All "Not Found" errors are routed like this.
 * @param {Error} [err]
 * @param {object} res
 */
function notFound(err, res) {
  if (!(err instanceof Error) && err) {
    res = err;
  }

  const message = 'Not Found',
    code = 404;

  // hide error from user of api.
  sendDefaultResponseForCode(code, message, res);
}

/**
 * All server errors should look like this.
 *
 * In general, 500s represent a _developer mistake_.  We should try to replace them with more descriptive errors.
 * @param {Error} err
 * @param {object} res
 */
function serverError(err, res) {
  // error is required to be logged
  log('error', err.message);
  console.log(err.stack);
  const message = err.message || 'Server Error', // completely hide these messages from outside
    code = 500;

  sendDefaultResponseForCode(code, message, res);
}

/**
 * All client errors should look like this.
 *
 * @param {object} res
 */
function unauthorized(res) {
  const err = new Error('Unauthorized request'),
    message = removePrefix(err.message, ':'),
    code = 401;

  sendDefaultResponseForCode(code, message, res);
}

/**
 * All client errors should look like this.

 * @param {Error} err
 * @param {object} res
 */
function clientError(err, res) {
  // They know it's a 400 already, we don't need to repeat the fact that its an error.
  const message = removePrefix(err.message, ':'),
    code = 400;

  sendDefaultResponseForCode(code, message, res);
}

/**
 * Handle errors in the standard/generic way
 * @param {object} res
 * @returns {function}
 */
function handleError(res) {
  return function (err) {
    if (err.name === 'NotFoundError' ||
      err.message.indexOf('ENOENT') !== -1 ||
      err.message.indexOf('not found') !== -1) {
      notFound(err, res);
      // if the word "client" is ever in a message, it should be for the client.  We enforce that here.
    } else if (err.message.indexOf('Client') !== -1) {
      clientError(err, res);
    } else {
      serverError(err, res);
    }
  };
}

/**
 * @param {object} req
 * @param {object} res
 * @param {function} next
 */
function acceptJSONOnly(req, res, next) {
  if (req.accepts('json')) {
    next();
  } else {
    notAcceptable({accept: ['application/json']})(req, res);
  }
}

/**
 * Reusable code to return Text data, both for good results AND errors.
 *
 * Captures and hides appropriate errors.
 *
 * @param {function} fn
 * @param {object} res
 */
function expectText(fn, res) {
  bluebird.try(fn).then(function (result) {
    res.send(result);
  }).catch(handleError(res));
}

/**
 * Reusable code to return JSON data, both for good results AND errors.
 *
 * Captures and hides appropriate errors.
 *
 * These return JSON always, because these endpoints are JSON-only.
 * @param {function} fn
 * @param {object} res
 */
function expectJSON(fn, res) {
  bluebird.try(fn).then(function (result) {
    res.json(result);
  }).catch(handleError(res));
}

/**
 * Allow the response type to be dymnamic. This is used for renderers which
 * may have need to define their own specific response type.
 *
 * @param  {Function} fn
 * @param  {Object}   res
 */
function expectResponseType(fn, res) {
  bluebird.try(fn).then(function (result) {
    res.type(result.type);
    res.send(result.output);
  }).catch(handleError(res));
}

/**
 * List all things in the db
 * @param {object} [options]
 * @param {string} [options.prefix]
 * @param {boolean} [options.values]
 * @param {function|array} [options.transforms]
 * @returns {function}
 */
function list(options) {
  return function (req, res) {
    let stream,
      listOptions = _.assign({
        prefix: references.uriSwapInSlug(req.uri, res.locals.site),
        values: false
      }, options);

    stream = db.list(listOptions);

    res.set('Content-Type', 'application/json');
    stream.pipe(res);
  };
}


function listAndSwapPrefix(req, res) {
  var stream,
    site = res.locals.site,
    options = {
      prefix: references.uriSwapInSlug(req.uri, site),
      values: false,
      transforms() {
        return [
          filter({wantStrings: true}, function (str) {
            return str.indexOf('@') === -1;
          }),
          map({ wantStrings: true }, function (str) {
            return references.uriSwapOutSlug(str, site);
          })
        ];
      }
    };

  stream = db.list(options);

  res.set('Content-Type', 'application/json');
  stream.pipe(res);
}

/**
 * List all users things in the db
 * @param {object} [options]
 * @param {string} [options.prefix]
 * @param {boolean} [options.values]
 * @param {function|array} [options.transforms]
 * @returns {function}
 */
function listUsers(options) {
  return function (req, res) {
    let stream,
      usersString = '/_users/',
      listOptions = _.assign({
        prefix: usersString,
        values: false,
        transforms() {
          return [map({ wantStrings: true }, function (str) {
            // We're going to construct base uri from the `getUri`
            // function, but that will include `/_users` so we want
            // to strip that out and then we're good
            return `${getUri(req).replace(usersString, '')}${str}`;
          })];
        }
      }, options);

    stream = db.list(listOptions);

    res.set('Content-Type', 'application/json');
    stream.pipe(res);
  };
}

/**
 * List all things in the db that start with this prefix
 * _and_ are published
 *
 * @param {Object} req
 * @param {Object} res
 * @returns {Function}
 */
function listWithPublishedVersions(req, res) {
  const site = res.locals.site,
    publishedString = '@published',
    options = {
      transforms() {
        return [
          filter({ wantStrings: true }, function (str) {
            return str.indexOf(publishedString) !== -1;
          }),
          map({ wantStrings: true }, function (str) {
            return references.uriSwapOutSlug(str, site);
          })
        ];
      }
    };

  // Trim the URI to `../pages` for the query to work
  req.uri = req.uri.replace(`/${publishedString}`, '');
  return list(options)(req, res);
}

/**
 * @param {object} req
 * @param {object} res
 */
function listAsReferencedObjects(req, res) {
  const readStream = db.list({
    json: false,
    keys: true,
    values: true,
    isArray: true,
    prefix: references.uriSwapInSlug(req.uri, res.locals.site)
  });

  highland(readStream)
    .map(convertDBListToReferenceObjects(res.locals.site))
    .toArray(function (resp) {
      // Send out the array of transformed objects
      res.set('Content-Type', 'application/json');
      res.send(resp);
    });
}

/**
 * @param {Object} site
 * @returns {Function}
 */
function convertDBListToReferenceObjects(site) {
  return function (obj) {
    var item = JSON.parse(obj.value);

    item[referencedProperty] = references.uriSwapOutSlug(obj.key, site);
    return item;
  };
}

/**
 * This route gets straight from the db.
 * @param {object} req
 * @param {object} res
 */
function getRouteFromDB(req, res) {
  expectJSON(function () {
    var { locals: { site } } = res;

    return db.get(references.uriSwapInSlug(req.uri, site))
      .then(references.refSlugToPrefix(site))
      .then(JSON.parse);
  }, res);
}

/**
 * This route puts straight to the db.
 *
 * Assumptions:
 * - that there is no extension if they're putting data.
 * @param {object} req
 * @param {object} res
 */
function putRouteFromDB(req, res) {
  expectJSON(function () {
    var { locals: { site } } = res,
      dbUri = references.uriSwapInSlug(req.uri, site),
      data = references.refPrefixToSlug(JSON.stringify(req.body), site);

    return db.put(dbUri, data).return(req.body);
  }, res);
}

/**
 * This route deletes from the db, and returns what used to be there.
 *
 * Assumptions:
 * - that there is no extension if they're deleting data.
 *
 * NOTE: Return the data it used to contain.  This is often used to create queues or messaging on the client-side,
 * because clients can guarantee that only one client was allowed to be the last one to fetch a particular item.
 *
 * @param {object} req
 * @param {object} res
 */
function deleteRouteFromDB(req, res) {
  expectJSON(function () {
    const dbUri = references.uriSwapInSlug(req.uri, res.locals.site);

    return db.get(dbUri)
      .then(references.refSlugToPrefix(res.locals.site))
      .then(JSON.parse)
      .then(oldData => db.del(dbUri).return(oldData));
  }, res);
}

// utility for routers
module.exports.removeQueryString = removeQueryString;
module.exports.removeExtension = removeExtension;
module.exports.normalizePath = normalizePath;
module.exports.getUri = getUri;

// error responses
module.exports.clientError = clientError; // 400 client error
module.exports.unauthorized = unauthorized; // 401 unauthorized error
module.exports.notFound = notFound; // 404 not found

module.exports.methodNotAllowed = methodNotAllowed; // nice 405
module.exports.notAcceptable = notAcceptable; // nice 406
module.exports.notImplemented = notImplemented; // nice 500
module.exports.serverError = serverError; // bad 500

// generic handlers
module.exports.varyWithoutExtension = varyWithoutExtension; // adds Vary header when missing extension
module.exports.onlyCachePublished = onlyCachePublished; // adds cache control when published or not
module.exports.denyTrailingSlashOnId = denyTrailingSlashOnId; // nice 400 about not adding trailing slash to id in url
module.exports.denyReferenceAtRoot = denyReferenceAtRoot; // nice 400 about _ref at root of object
module.exports.handleError = handleError; // 404 or 500 based on exception
module.exports.acceptJSONOnly = acceptJSONOnly; // 406 on non-JSON body
module.exports.expectText = expectText;
module.exports.expectJSON = expectJSON;
module.exports.expectResponseType = expectResponseType;

// straight from DB
module.exports.list = list;
module.exports.listUsers = listUsers;
module.exports.listWithPublishedVersions = listWithPublishedVersions;
module.exports.listAndSwapPrefix = listAndSwapPrefix;
module.exports.listAsReferencedObjects = listAsReferencedObjects;
module.exports.getRouteFromDB = getRouteFromDB;
module.exports.putRouteFromDB = putRouteFromDB;
module.exports.deleteRouteFromDB = deleteRouteFromDB;

// For testing
module.exports.setLog = function (fakeLog) {
  log = fakeLog;
};
