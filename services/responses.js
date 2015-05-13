/**
 * Collection of well-tested responses
 *
 * @module
 */

'use strict';

var _ = require('lodash'),
  db = require('./db'),
  bluebird = require('bluebird'),
  log = require('./log'),
  Flake = require('flake-idgen'),
  filter = require('through2-filter'),
  flake = new Flake();

function getUniqueId() {
  return flake.next().toString('base64');
}

/**
 * Duck-typing.
 *
 * If the object has `.then`, we assume its a promise
 * @param {*} obj
 * @returns {boolean}
 */
function isPromise(obj) {
  return _.isObject(obj) && _.isFunction(obj.then);
}

/**
 * Duck-typing.
 *
 * If the object has `.pipe` as a function, we assume its a pipeable stream
 */
function isPipeableStream(obj) {
  return _.isObject(obj) && _.isFunction(obj.pipe);
}

/**
 * Remove extension from route / path.
 * @param {string} path
 * @returns {string}
 */
function removeExtension(path) {
  return path.split('.')[0];
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
 *
 * @param path
 * @returns {string}
 */
function normalizePath(path) {
  return removeExtension(removeQueryString(path));
}

/**
 * This route is not implemented.
 * @param req
 * @param res
 */
function notImplemented(req, res) {
  var code = 501,
    message = 'Not Implemented';
  res.status(code).format({
    json: function () {
      //send the message as well
      res.send({
        message: message,
        code: code
      });
    },
    html: function () {
      //send some html (should probably be some default, or a render of a 500 page).
      res.send(code + ' ' + message);
    },
    'default': function () {
      //send whatever is default for this type of data with this status code.
      res.sendStatus(code);
    }
  });
}

/**
 * This method not allowed
 * @param {{allow: [string]}} options
 */
function methodNotAllowed(options) {
  var allowed = options && options.allow || [];
  return function (req, res) {
    var code = 405,
      method = req.method,
      message = 'Method ' + method + ' not allowed';
    res.set('Allow', allowed.join(', ').toUpperCase());
    res.status(code).format({
      json: function () {
        //send the message as well
        res.send({
          message: message,
          code: code,
          allow: allowed
        });
      },
      html: function () {
        //send some html (should probably be some default, or a render of a 500 page).
        res.send(code + ' ' + message);
      },
      'default': function () {
        //send whatever is default for this type of data with this status code.
        res.sendStatus(code);
      }
    });
  };
}

/**
 * This route not allowed
 * @param {[string]} options
 */
function notAcceptable(options) {
  var acceptable = options && options.accept || [];
  return function (req, res) {
    var code = 406,
      accept = req.get('Accept'),
      message = accept + ' not acceptable';
    res.set('Accept', acceptable.join(', ').toUpperCase());
    res.status(code).format({
      json: function () {
        //send the message as well
        res.send({
          message: message,
          code: code,
          accept: acceptable
        });
      },
      html: function () {
        //send some html (should probably be some default, or a render of a 500 page).
        res.send(code + ' ' + message);
      },
      'default': function () {
        //send whatever is default for this type of data with this status code.
        res.sendStatus(code);
      }
    });
  };
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

  //hide error from user of api.
  res.status(404).format({
    json: function () {
      //send the message as well
      res.send({
        message: 'Not Found',
        code: 404
      });
    },
    html: function () {
      //send some html (should probably be some default, or render of a 404 page).
      res.send('404 Not Found');
    },
    'default': function () {
      //send whatever is default for this type of data with this status code.
      res.sendStatus(404);
    }
  });
}

/**
 * All server errors should look like this.
 *
 * In general, 500s represent a _developer mistake_.  We should try to replace them with more descriptive errors.
 * @param {Error} err
 * @param res
 */
function serverError(err, res) {
  //error is required to be logged
  log.error(err.stack);

  res.status(500).format({
    json: function () {
      //send the message as well
      res.send({
        message: err.message,
        code: 500
      });
    },
    html: function () {
      //send some html (should probably be some default, or a render of a 500 page).
      res.send('500 Server Error');
    },
    'default': function () {
      //send whatever is default for this type of data with this status code.
      res.sendStatus(500);
    }
  });
}

/**
 * All server errors should look like this.
 *
 * In general, 500s represent a _developer mistake_.  We should try to replace them with more descriptive errors.
 * @param {Error} err
 * @param res
 */
function clientError(err, res) {
  res.status(400).format({
    json: function () {
      //send the message as well
      res.send({
        message: err.message,
        code: 400
      });
    },
    html: function () {
      //send some html (should probably be some default, or a render of a 500 page).
      res.send('400 Client Error: ' + err.message);
    },
    'default': function () {
      //send whatever is default for this type of data with this status code.
      res.sendStatus(400);
    }
  });
}

function handleError(res) {
  return function (err) {
    if ((err.name === 'NotFoundError') ||
      (err.message.indexOf('ENOENT') !== -1) ||
      (err.message.indexOf('not found') !== -1)) {
      notFound(err, res);
    } else if ((err.name === 'BadRequestError')) {
      clientError(err, res);
    } else {
      serverError(err, res);
    }
  };
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
    res.send(result);
  }).catch(handleError(res));
}

/**
 * List all things in the db
 * @param [options]
 *   options.prefix: string
 *   options.values: boolean,
 *   options.filters: array
 */
function list(options) {
  options = options || {};

  return function (req, res) {
    var listOptions = _.defaults(options || {}, {
        prefix: normalizePath(req.baseUrl + req.url),
        values: false
      }),
      list = db.list(listOptions);

    if (isPromise(list)) {
      expectJSON(_.constant(list));
    } else if (isPipeableStream(list)) {
      res.set('Content-Type', 'application/json');
      list.on('error', function (error) {
        log.error('listAllWithPrefix::error', listOptions.prefix, error);
      }).pipe(res);
    } else {
      throw new Error('listAllWithPrefix cannot handle type ' + (typeof list));
    }
  };
}

/**
 * List all things in the db that start with this prefix
 * @param [options]
 */
function listWithoutVersions(options) {
  options = _.defaults(options || {}, {
    filters: [filter({wantStrings: true}, function (str) {
      return str.indexOf('@') === -1;
    })]
  });
  return list(options);
}

/**
 * This route gets straight from the db.
 * @param req
 * @param res
 */
function getRouteFromDB(req, res) {
  expectJSON(function () {
    return db.get(normalizePath(req.baseUrl + req.url)).then(JSON.parse);
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
    return db.put(normalizePath(req.baseUrl + req.url), JSON.stringify(req.body)).return(req.body);
  }, res);
}

//utility for routers
module.exports.removeQueryString = removeQueryString;
module.exports.removeExtension = removeExtension;
module.exports.normalizePath = normalizePath;
module.exports.getUniqueId = getUniqueId;

//error responses
module.exports.clientError = clientError; //400 client error
module.exports.notFound = notFound; //404 not found
module.exports.methodNotAllowed = methodNotAllowed; //nice 405
module.exports.notAcceptable = notAcceptable; //nice 406
module.exports.notImplemented = notImplemented; //nice 500
module.exports.serverError = serverError; //bad 500

//generic handlers
module.exports.handleError = handleError; //404 or 500 based on exception
module.exports.expectJSON = expectJSON;
module.exports.expectHTML = expectHTML;

//straight from DB
module.exports.list = list;
module.exports.listWithoutVersions = listWithoutVersions;
module.exports.getRouteFromDB = getRouteFromDB;
module.exports.putRouteFromDB = putRouteFromDB;
