'use strict';

const responses = require('../responses'),
  controller = require('../services/lists'),
  { withAuthLevel, authLevels } = require('../auth');

function put(req, res) {
  responses.expectJSON(() => controller.put(req.uri, req.body), res);
}

function put(req, res) {
  responses.expectJSON(() => controller.put(req.uri, req.body), res);
}

function getAllLists(req, res) {
  responses.expectJSON(() => controller.getAllLists(), res);
}

function routes(router) {
  router.use(responses.varyWithoutExtension({varyBy: ['Accept']}));
  router.all('*', responses.acceptJSONOnly);
  router.all('/', responses.methodNotAllowed({allow: ['get']}));
  router.get('/', getAllLists);
  router.all('/:name', responses.methodNotAllowed({allow: ['get', 'put']}));
  router.get('/:name', responses.listAsReferencedObjects);
  router.put('/:name', withAuthLevel(authLevels.WRITE));
  router.put('/:name', put);
  router.get('/:name/:id', responses.getRouteFromDB);
  router.put('/:name/:id', withAuthLevel(authLevels.WRITE));
  router.put('/:name/:id', put);
}

module.exports = routes;
