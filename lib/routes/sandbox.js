/**
 * Controller for Sandbox
 *
 * @module
 */

'use strict';

var responses = require('../responses'),
  composer = require('../composer');

/**
 * @param {object} req
 * @param {object} res
 */
function getRouteFromSandbox(req, res) {
  res.locals.name = req.params.name;
  responses.expectHTML(function () {
    return composer.renderComponent('/components/sandbox/instances/0', res);
  }, res);
}

function routes(router) {
  router.get('/:name', getRouteFromSandbox);
}

module.exports = routes;
