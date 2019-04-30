'use strict';

var db = require('./services/db'),
  log = require('./services/logger').setup({
    file: __filename
  });
const _ = require('lodash'),
  bluebird = require('bluebird'),
  filter = require('through2-filter'),
  metaController = require('./services/metadata');

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
  log('error', err.message, { stack: err.stack });

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
  log('error', err.message, { stack: err.stack });
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
    if (err.status && err.name !== 'NotFoundError') {
      // If we're in this block, the error has a defined `status` property and
      // the error should be directed out immediately
      sendDefaultResponseForCode(err.status, err.message, res);
    } else if (err.name === 'NotFoundError' ||
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
  bluebird.try(fn).then(result => {
    res.set('Content-Type', 'text/plain');
    res.send(result);
  }).catch(handleError(res));
}

/**
 * Checks the archived property on the request object to determine if the
 * request is attempting to archive the page. If true, checks the published
 * property on the meta object of the page, by calling checkProps.
 * @param {object} req
 * @param {object} res
 * @param {function} next
 * @returns {Promise | void}
 */
function checkArchivedToPublish(req, res, next) {
  if (req.body.archived) {
    return metaController.checkProps(req.uri, 'published')
      .then(resp => {
        if (resp === true) {
          throw new Error('Client error, cannot modify archive while page is published'); // archived true, published true
        } else next();
      })
      .catch(err => handleError(res)(err));
  } else next();
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
 * List all things in the db
 * @param {object} [options]
 * @param {string} [options.prefix]
 * @param {boolean} [options.values]
 * @param {function|array} [options.transforms]
 * @returns {function}
 */
function list(options) {
  return function (req, res) {
    let list,
      listOptions = _.assign({
        prefix: req.uri,
        values: false
      }, options);

    list = db.list(listOptions);

    res.set('Content-Type', 'application/json');
    list.pipe(res);
  };
}

/**
 * List all things in the db that start with this prefix
 * @returns {function}
 */
function listWithoutVersions() {
  const options = {
    transforms() {
      return [filter({wantStrings: true}, function (str) {
        return str.indexOf('@') === -1;
      })];
    }
  };

  return list(options);
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
  const publishedString = '@published',
    options = {
      transforms() {
        return [filter({ wantStrings: true }, function (str) {
          return str.indexOf(publishedString) !== -1;
        })];
      }
    };

  // Trim the URI to `../pages` for the query to work
  req.uri = req.uri.replace(`/${publishedString}`, '');
  return list(options)(req, res);
}

/**
 * This route gets straight from the db.
 * @param {object} req
 * @param {object} res
 */
function getRouteFromDB(req, res) {
  expectJSON(() => db.get(req.uri), res);
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
    return db.put(req.uri, JSON.stringify(req.body)).then(() => req.body);
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
  expectJSON(() => {
    return db.get(req.uri)
      .then(oldData => db.del(req.uri).then(() => oldData));
  }, res);
}

/**
 * Forces a redirect back to the non-published
 * version of a uri
 *
 * @param {Number} code
 * @returns {Function}
 */
function forceEditableInstance(code = 303) {
  return (req, res) => {
    res.redirect(code, `${res.locals.site.protocol}://${req.uri.replace('@published', '')}`);
  };
}

// utility for routers
module.exports.removeQueryString = removeQueryString;
module.exports.removeExtension = removeExtension;
module.exports.normalizePath = normalizePath;
module.exports.getUri = getUri;

// redirect responses
module.exports.forceEditableInstance = forceEditableInstance;

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
module.exports.checkArchivedToPublish = checkArchivedToPublish;

// straight from DB
module.exports.list = list;
module.exports.listWithPublishedVersions = listWithPublishedVersions;
module.exports.listWithoutVersions = listWithoutVersions;
module.exports.getRouteFromDB = getRouteFromDB;
module.exports.putRouteFromDB = putRouteFromDB;
module.exports.deleteRouteFromDB = deleteRouteFromDB;

// For testing
module.exports.setLog = mock => log = mock;
module.exports.setDb = mock => db = mock;
