/**
 * Collection of well-tested responses
 *
 * @module
 */

'use strict';

var _ = require('lodash'),
  db = require('./services/db'),
  bluebird = require('bluebird'),
  log = require('./log'),
  filter = require('through2-filter');

/**
 * Finds prefixToken, and removes it and anything before it.
 *
 * @param {string} str
 * @param {string} prefixToken
 * @returns {string}
 */
function removePrefix(str, prefixToken) {
  var index =  str.indexOf(prefixToken);
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
  var leadingDot, endSlash = path.lastIndexOf('/');
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
 * @param path
 * @returns {string}
 */
function normalizePath(path) {
  return removeExtension(removeQueryString(path));
}

/**
 * @param req
 * @returns {string}
 */
function getUri(req) {
  return normalizePath(req.hostname + req.baseUrl + req.path);
}

/**
 * Send whatever is default for this type of data with this status code.
 * @param {number} code
 * @param res
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
 * @param res
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
 * @param res
 * @param {object} extras
 * @returns {function}
 */
function sendJSONErrorCode(code, message, res, extras) {
  return function () {
    res.json(_.assign({
      message: message,
      code: code
    }, extras));
  };
}

/**
 * @param {number} code
 * @param {string} message
 * @param res
 * @param {object} extras
 */
function sendDefaultResponseForCode(code, message, res, extras) {
  res.status(code).format({
    json: sendJSONErrorCode(code, message, res, extras),
    html: sendHTMLErrorCode(code, message, res),
    default: sendDefaultErrorCode(code, res)
  });
}

/**
 * This route is not implemented.
 * @param req
 * @param res
 */
function notImplemented(req, res) {
  var code = 501,
    message = 'Not Implemented';
  sendDefaultResponseForCode(code, message, res);
}

/**
 * This method not allowed
 * @param {{allow: [string]}} options
 * @returns {function}
 */
function methodNotAllowed(options) {
  var allowed = options.allow;
  return function (req, res, next) {
    var message, code,
      method = req.method;

    if (_.contains(allowed, method.toLowerCase())) {
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
  var acceptableTypes = options.accept;
  return function (req, res, next) {
    var message, code,
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
 * @param {{varyBy: [string]}} options
 * @returns {function}
 */
function varyWithoutExtension(options) {
  var varyBy = options.varyBy.join(', ');

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
 * @param req
 * @param res
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
 * @param res
 */
function notFound(err, res) {
  if (!(err instanceof Error) && err) {
    res = err;
  }

  var message = 'Not Found',
    code = 404;

  // hide error from user of api.
  sendDefaultResponseForCode(code, message, res);
}

/**
 * @param {{extensions: [string]}} options
 * @returns {function}
 */
function onlyAcceptExtensions(options) {
  var extensions = options.extensions;

  return function (req, res, next) {
    var type, isType,
      ext = req.params.ext.toLowerCase(),
      accepts = req.headers.accept,
      isAll = accepts.indexOf('*/*') !== -1;

    if (!extensions[ext]) {
      return notFound(res);
    }

    type = extensions[ext];
    isType = accepts.indexOf(type) !== -1;

    if (!isAll && !isType) {
      notAcceptable({accept: [type]})(req, res, next);
    } else {
      req.headers.accept = type;
      next();
    }
  };
}

/**
 * All server errors should look like this.
 *
 * In general, 500s represent a _developer mistake_.  We should try to replace them with more descriptive errors.
 * @param {Error} err
 * @param res
 */
function serverError(err, res) {
  // error is required to be logged
  log.error(err.stack);

  var message = 'Server Error', //completely hide these messages from outside
    code = 500;

  sendDefaultResponseForCode(code, message, res);
}

/**
 * All client errors should look like this.

 * @param {Error} err
 * @param res
 */
function clientError(err, res) {
  //They know it's a 400 already, we don't need to repeat the fact that its an error.
  var message = removePrefix(err.message, ':'),
    code = 400;

  sendDefaultResponseForCode(code, message, res);
}

/**
 * Handle errors in the standard/generic way
 * @param res
 * @returns {function}
 */
function handleError(res) {
  return function (err) {
    if ((err.name === 'NotFoundError') ||
      (err.message.indexOf('ENOENT') !== -1) ||
      (err.message.indexOf('not found') !== -1)) {
      notFound(err, res);
      //if the word "client" is ever in a message, it should be for the client.  We enforce that here.
    } else if (err.message.indexOf('Client') !== -1) {
      clientError(err, res);
    } else {
      serverError(err, res);
    }
  };
}

/**
 * @param req
 * @param res
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
 * @param res
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
 * @param res
 */
function expectJSON(fn, res) {
  bluebird.try(fn).then(function (result) {
    res.json(result);
  }).catch(handleError(res));
}

/**
 * Reusable code to return JSON data, both for good results AND errors.
 *
 * Captures and hides appropriate errors.
 *
 * These return HTML always, because these endpoints are HTML-only.
 * @param {function} fn
 * @param res
 */
function expectHTML(fn, res) {
  bluebird.try(fn).then(function (result) {
    res.type('html');
    res.send(result);
  }).catch(handleError(res));
}

/**
 * List all things in the db
 * @param {object} [options]
 * @param {string} [options.prefix]
 * @param {string} [options.values]
 * @param {function|array} [options.transforms]
 * @returns {function}
 */
function list(options) {
  return function (req, res) {
    var list,
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
 * @returns {Promise|Stream}
 */
function listWithoutVersions() {
  var options = {
    transforms: function () {
      return [filter({wantStrings: true}, function (str) { return str.indexOf('@') === -1; })];
    }
  };
  return list(options);
}

/**
 * This route gets straight from the db.
 * @param req
 * @param res
 */
function getRouteFromDB(req, res) {
  expectJSON(function () {
    return db.get(req.uri).then(JSON.parse);
  }, res);
}

/**
 * This route puts straight to the db.
 *
 * Assumptions:
 * - that there is no extension if they're putting data.
 * @param req
 * @param res
 */
function putRouteFromDB(req, res) {
  expectJSON(function () {
    return db.put(req.uri, JSON.stringify(req.body)).return(req.body);
  }, res);
}

// utility for routers
module.exports.removeQueryString = removeQueryString;
module.exports.removeExtension = removeExtension;
module.exports.normalizePath = normalizePath;
module.exports.getUri = getUri;

// error responses
module.exports.clientError = clientError; // 400 client error
module.exports.notFound = notFound; // 404 not found

module.exports.methodNotAllowed = methodNotAllowed; // nice 405
module.exports.notAcceptable = notAcceptable; // nice 406
module.exports.notImplemented = notImplemented; // nice 500
module.exports.serverError = serverError; // bad 500

// generic handlers
module.exports.varyWithoutExtension = varyWithoutExtension; // adds Vary header when missing extension
module.exports.onlyCachePublished = onlyCachePublished; // adds cache control when published or not
module.exports.handleError = handleError; // 404 or 500 based on exception
module.exports.acceptJSONOnly = acceptJSONOnly; // 406 on non-JSON body
module.exports.onlyAcceptExtensions = onlyAcceptExtensions; // nice 404 for unsupported extensions
module.exports.expectText = expectText;
module.exports.expectJSON = expectJSON;
module.exports.expectHTML = expectHTML;

// straight from DB
module.exports.list = list;
module.exports.listWithoutVersions = listWithoutVersions;
module.exports.getRouteFromDB = getRouteFromDB;
module.exports.putRouteFromDB = putRouteFromDB;
