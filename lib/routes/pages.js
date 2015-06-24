/**
 * Controller for Pages
 *
 * @module
 */

'use strict';

var _ = require('lodash'),
  is = require('../assert-is'),
  db = require('../services/db'),
  bluebird = require('bluebird'),
  responses = require('../responses'),
  composer = require('../composer'),
  references = require('../services/references'),
  log = require('../log'),
  uid = require('../uid'),
  chalk = require('chalk'),
  components = require('../services/components');

/**
 * Get a list of the areas in a layout that have to be filled with pageData.
 * @param layoutData
 */
function findLayoutAreas(layoutData) {
  return _.reduce(_.listDeepObjects(layoutData, _.isArray), function (obj, areaList) {
    _.each(areaList, function (item) {
      if (_.isString(item)) {
        obj[item] = '';
      }
    });
    return obj;
  }, {});
}

/**
 * @throws if there are missing or extra pageData, with appropriate message
 * @param {object} pageData
 * @param {object} layoutData
 */
function validatePageData(pageData, layoutData) {
  var areas = findLayoutAreas(layoutData),
    diff = _.difference(Object.keys(areas), Object.keys(pageData));

  if (diff.length > 0) {
    throw new Error((_.has(areas, diff[0]) ? 'Missing' : 'Extra') + ' layout area: ' + diff[0]);
  }
}

/**
 * @param {[{}]} ops
 */
function logBatchOperations(ops) {
  log.info(chalk.blue('Batch operation:\n') + _.map(ops, function (op, index) {
      return chalk.blue('op ' + index + ': ') + require('util').inspect(op);
    }).join('\n'));
}

/**
 * @param {string} ref
 * @param {object} data
 * @param {array} ops
 */
function addOp(ref, data, ops) {
  ops.push({
    type: 'put',
    key: ref,
    value: JSON.stringify(data)
  });
}

/**
 * Create new copies of components from defaults
 * @param pageData
 * @returns {Promise}
 */
function cloneDefaultComponents(pageData) {
  var ops = [];
  return bluebird.props(_.reduce(pageData, function (obj, value, key) {
    var componentName = components.getName(value);

    obj[key] = components.get('/components/' + componentName).then(function (componentData) {
      var componentInstance = '/components/' + componentName + '/instances/' + uid();
      addOp(componentInstance, componentData, ops);
      return componentInstance;
    });

    return obj;
  }, {})).then(function (data) {
    return [data, ops];
  });
}

/**
 * returns HTML
 *
 * @param req
 * @param res
 */
function renderPage(req, res) {
  responses.expectHTML(function () {
    return composer.renderPage(responses.normalizePath(req.baseUrl + req.url), res);
  }, res);
}

/**
 * Change the acceptance type based on the extension they gave us
 *
 * @param req
 * @param res
 */
function routeByExtension(req, res) {
  switch (req.params.ext.toLowerCase()) {
    case 'html':
      req.headers.accept = 'text/html';
      renderPage(req, res);
      break;

    case 'json': // jshint ignore:line
    default:
      req.headers.accept = 'application/json';
      responses.getRouteFromDB(req, res);
      break;
  }
}

/**
 * Replace the referenced things in the page data with a different version
 * @param {object} data
 * @param {string} version
 * @returns {object}
 */
function replacePageReferenceVersions(data, version) {
  var replaceVersion = _.partial(references.replaceVersion, _, version);

  return _.mapValues(data, function (value) {
    if (typeof value === 'string') {
      return replaceVersion(value);
    } else if (_.isArray(value)) {
      return _.map(value, replaceVersion);
    } else {
      return value;
    }
  });
}

/**
 * Create new versions of all components and save to them all to @published
 *
 * @param req
 * @param res
 */
function publishPage(req, res) {
  responses.expectJSON(function () {
    var published = 'published',
      ref = references.replaceVersion(responses.normalizePath(req.baseUrl + req.url), published),
      refs = _.flatten(_.values(req.body)),
      data = replacePageReferenceVersions(req.body, published);

    return bluebird.map(refs, function (ref) {
      /**
       * 1) Get reference (could be latest, could be other)
       * 2) Get all references within reference
       * 3) Replace all references with @published (including root reference)
       * 4) Get list of put operations needed
       */
      return components.get(ref)
        .then(composer.resolveDataReferences)
        .then(references.replaceAllVersions(published))
        .then(function (data) { return [references.replaceVersion(ref, published), data]; })
        .spread(components.getPutOperations);
    }).then(function (ops) {
      //only one level of flattening needed, because getPutOperations should have flattened its list already
      ops = _.flatten(ops);
      //add page PUT operation
      addOp(ref, data, ops);
      return db.batch(ops).return(data);
    });
  }, res);
}

/**
 * First draft
 * @param req
 * @param res
 */
function createPage(req, res) {
  var body = req.body,
    layoutReference = body && body.layout,
    pageData = body && _.omit(body, 'layout'),
    pageReference = '/pages/' + uid();

  is(layoutReference, 'layout reference');

  responses.expectJSON(function () {
    return components.get(layoutReference).then(function (layoutData) {
      validatePageData(pageData, layoutData);

      return cloneDefaultComponents(pageData);
    }).spread(function (pageData, ops) {
      pageData.layout = layoutReference;

      addOp(pageReference, pageData, ops);

      logBatchOperations(ops);

      return db.batch(ops)
        .then(function () {
          //creation success!
          res.status(201);

          //if successful, return new page object, but include the (optional) self reference to the new page.
          pageData._ref = pageReference;
          return pageData;
        });
    });
  }, res);
}

function routes(router) {
  router.use(responses.varyWithoutExtension({varyBy: ['Accept']}));
  router.use(responses.onlyCachePublished);

  router.all('/', responses.methodNotAllowed({allow: ['get']}));
  router.all('/', responses.notAcceptable({accept: ['application/json']}));
  router.get('/', responses.listWithoutVersions());

  router.all('/:name.:ext', responses.methodNotAllowed({allow: ['get']}));
  router.all('/:name.:ext', responses.notAcceptable({accept: ['text/html']}));
  router.get('/:name.:ext', routeByExtension);

  router.all('/:name@:version', responses.acceptJSONOnly);
  router.all('/:name@:version', responses.methodNotAllowed({allow: ['get', 'put']}));
  router.get('/:name@:version', responses.getRouteFromDB);
  router.put('/:name@published', publishPage);
  router.put('/:name@:version', responses.putRouteFromDB);

  router.all('/:name', responses.methodNotAllowed({allow: ['get', 'put']}));
  router.all('/:name', responses.notAcceptable({accept: ['application/json']}));
  router.get('/:name', responses.getRouteFromDB);
  router.put('/:name', responses.putRouteFromDB);
  router.post('/', createPage);
}

module.exports = routes;