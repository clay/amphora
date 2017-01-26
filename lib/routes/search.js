/**
 * Controller for Search
 *
 * @module
 */

'use strict';

const responses = require('../responses'),
  search = require('../services/search');

/**
 * This route passes a payload through to the
 * Elastic Search service and then sends
 * back a JSON response.
 *
 * @param  {object} req [description]
 * @param  {object} res [description]
 */
function response(req, res) {
  var payload = JSON.parse(req.body);

  responses.expectJSON(elasticPassthrough(payload), res);
}

/**
 * Return a function for `expectJSON` to evaluate which
 * will query Elastic with the payload from the client's
 * request
 *
 * @param  {object} queryObj
 * @return {function}
 */
function elasticPassthrough(queryObj) {
  return function () {
    return search.RESTQuery(queryObj);
  };
}

function routes(router) {
  router.use(responses.varyWithoutExtension({varyBy: ['Accept']}));
  router.all('/', responses.methodNotAllowed({allow: ['post']}));
  router.all('/', responses.notAcceptable({accept: ['application/json']}));
  router.post('/', response);
}

module.exports = routes;
// For testing
module.exports.elasticPassthrough = elasticPassthrough;
module.exports.response = response;
