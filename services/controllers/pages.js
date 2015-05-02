/**
 * Controller for Pages
 *
 * @module
 */

'use strict';

var bluebird = require('bluebird'),
  references = require('../references'),
  responses = require('../responses');


/**
 * First draft
 * @param req
 * @param res
 */
function createPage(req, res) {
  function getUniqueId() {
    return flake.next().toString('base64');
  }

  var ops = [],
    Flake = require('flake-idgen'),
    flake = new Flake(),
    body = req.body,
    layoutReference = body && body.layout,
    pageData = body && _.omit(body, 'layout'),
    pageReference = '/pages/' + getUniqueId();

  pageData = _.reduce(pageData, function (obj, value, key) {
    //create new copy of component from defaults
    var componentName = references.getComponentName(value);

    obj[key] = references.getComponentData('/components/' + componentName).then(function (componentData) {
      var componentInstance = '/components/' + componentName + '/instances/' + getUniqueId();
      ops.push({
        type: 'put',
        key: componentInstance,
        value: componentData
      });
      return componentInstance;
    });

    return obj;
  }, {
    layout: layoutReference
  });

  bluebird.props(pageData)
    .then(function (value) {

      ops.push({
        type: 'put',
        key: pageReference,
        value: value
      });

      return db.batch(ops)
        .then(function () {
          //if successful, return new page object, but include the (optional) self reference to the new page.
          value._ref = pageReference;
          return value;
        });
    }).then(function (result) {
      res.send(result);
    }).catch(function (err) {
      log.error('Failed to create new page' + err.stack);
    });
}

function routes(router) {
  router.get('/', responses.listAllWithPrefix);
  router.get('/:name', responses.getRouteFromDB);
  router.put('/:name', responses.putRouteFromDB);
  router.post('/', createPage);
}

module.exports = routes;