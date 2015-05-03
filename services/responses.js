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
  return path.split('.').shift();
}

/**
 * remove querystring from route / path.
 * @param  {string} path
 * @return {string}
 */
function removeQueryString(path) {
  return path.split('?').shift();
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
  res.sendStatus(501);
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

function handleError(res) {
  return function (err) {
    if ((err.name === 'NotFoundError') ||
      (err.message.indexOf('ENOENT') !== -1) ||
      (err.message.indexOf('not found') !== -1)) {
      notFound(err, res);
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
 * List all things in the db that start with this prefix
 * @param req
 * @param res
 */
function listAllWithPrefix(req, res) {
  var path = normalizePath(req.baseUrl + req.url),
    list = db.list({prefix: path, values: false});

  if (isPromise(list)) {
    expectJSON(_.constant(list));
  } else if (isPipeableStream(list)) {
    list.on('error', function (error) {
      log.error('listAllWithPrefix::error', path, error);
    }).pipe(res);
  } else {
    throw new Error('listAllWithPrefix cannot handle type ' + (typeof list));
  }
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
    return db.put(normalizePath(req.baseUrl + req.url), JSON.stringify(req.body));
  }, res);
}

//utility for routers
module.exports.removeQueryString = removeQueryString;
module.exports.removeExtension = removeExtension;
module.exports.normalizePath = normalizePath;
module.exports.getUniqueId = getUniqueId;

//error responses
module.exports.notFound = notFound; //404
module.exports.notImplemented = notImplemented; //nice 500
module.exports.serverError = serverError; //bad 500

//generic handlers
module.exports.handleError = handleError; //404 or 500 based on exception
module.exports.expectJSON = expectJSON;
module.exports.expectHTML = expectHTML;

//straight from DB
module.exports.listAllWithPrefix = listAllWithPrefix;
module.exports.getRouteFromDB = getRouteFromDB;
module.exports.putRouteFromDB = putRouteFromDB;
