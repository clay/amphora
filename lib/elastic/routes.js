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
 * @param  {object} req request body search
 * @param  {object} res hits matching query
 */
function response(req, res) {
  var payload = req.body,
    index = payload.index,
    type = payload.type,
    query = payload.body;

  responses.expectJSON(elasticPassthrough(index, query, type), res);
}

/**
 * Return a function for `expectJSON` to evaluate which
 * will query Elastic with the payload from the client's
 * request
 *
 * @param  {string} index
 * @param  {object} query
 * @param  {string} type
 * @return {function}
 */
function elasticPassthrough(index, query, type) {
  return function () {
    return search.query(index, query, type);
  };
}

function routes(router) {
  router.use(responses.varyWithoutExtension({varyBy: ['Accept']}));
  router.all('/_search', responses.methodNotAllowed({allow: ['post']}));
  router.all('/_search', responses.notAcceptable({accept: ['application/json']}));
  router.post('/_search', response);
}

module.exports = routes;
// For testing
module.exports.elasticPassthrough = elasticPassthrough;
module.exports.response = response;
