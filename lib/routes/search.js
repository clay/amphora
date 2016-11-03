/**
 * Controller for Search
 *
 * @module
 */

'use strict';

const responses = require('../responses');

function routes(router) {
  router.use(responses.varyWithoutExtension({varyBy: ['Accept']}));
  router.all('/', responses.methodNotAllowed({allow: ['post']}));
  router.all('/', responses.notAcceptable({accept: ['application/json']}));
  router.post('/', responses.queryElastic);
}

module.exports = routes;
