'use strict';

const _ = require('lodash'),
  bluebird = require('bluebird'),
  components = require('./components'),
  references = require('./references'),
  h = require('highland'),
  mapLayoutToPageData = require('../utils/layout-to-page-data'),
  { getComponentName } = require('clayutils'),
  files = require('../files'),
  REF_PROPERTY = '_ref',
  upgrade = require('./upgrade'),
  db = require('./db'),
  elasticsearch = require('elasticsearch'),
  esclient = new elasticsearch.Client({
    host: 'localhost:9200',
    apiVersion: '6.x'
  });

/**
 * Compose a component, recursively filling in all component references with
 * instance data.
 * @param {object} data
 * @param {object} locals  Extra data that some GETs use
 * @param {object} queryResults Object mapping instance IDs to query results
 * @returns {Promise} - Resolves with composed component data
 */
function resolveComponentReferences(data, locals, queryResults) {
  const referenceObjects = references.listDeepObjects(data, REF_PROPERTY);

  return bluebird.all(referenceObjects).each(function (referenceObject) {
    const uri = referenceObject[REF_PROPERTY];

    return components.get(uri, locals, queryResults && queryResults[uri])
      .then(function (obj) {
        // the thing we got back might have its own references
        return resolveComponentReferences(obj, locals, queryResults).finally(function () {
          _.assign(referenceObject, _.omit(obj, REF_PROPERTY));
        }).catch(function (error) {
          // add additional information to the error message
          const wrappedError = new Error(error.message + ' within ' + referenceObject[REF_PROPERTY]);

          wrappedError.name = error.name;
          throw wrappedError;
        });
      });
  }).return(data);
}

/**
 * Given a component URI and locals, stream the instance's Elastic query.
 * @param  {string} uri
 * @param  {Object} locals
 * @return {Stream}
 */
function resolveCmptQuery(uri, locals) {
  const name = getComponentName(uri),
    upgradeFnc = upgrade.init(uri, locals);

  return h.of(uri)
    .flatMap(uri => h(db.get(uri)))
    .map(JSON.parse)
    .flatMap(data => h(upgradeFnc(data)))
    .flatMap(data => {
      const componentModule = name && files.getComponentModule(name),
        result = componentModule.query(uri, data, locals);

      if (typeof data === 'object' && data.then) return h(result);
      return h.of(result);
    });
}

/**
 * Resolve all the specified scopes and stream and object mapping each
 * component URI to its Elastic results.
 * @param  {Object} scopes, mapping scope ID to arrays of URIs
 * @param {Object} locals
 * @return {Stream} of an object that map cmpt instace refs to Elastic results
 */
function resolveScopes(scopes, locals) {
  if (!scopes) return h.of({});
  return h.values(scopes)
    .flatMap(scope => {
      const exclude = [];

      return h(scope.map((uri, index) => ({uri, index, exclude})));
    })
    .flatMap(task => resolveCmptQuery(task.uri, locals)
      .map(query => Object.assign(task, {query}))
    )
    // group tasks by generation
    .reduce([], (acc, curr) => (acc[curr.index] || []).concat([curr]))
    .flatMap(h.of)
    .flatMap(executeGeneration)
    .reduce({}, _.extend);
}

function executeGeneration(tasks) {
  const queries = tasks.map(i => i.query);

  return streamSearch(queries)
    .flatMap(({responses}) => {
      return h(responses.map((response, index) => {
        const task = tasks[index],
          status = response.status;
        let hits;

        if (status !== 200) {
          return {[task.uri]: []};
        }
        hits = response.hits.hits;
        task.exclude = task.exclude.concat(hits.map(i => i._doc));
        return {[task.uri]: hits.map(i => i._source)};
      }));
    });
}

function streamSearch(queries) {
  const body = queries.reduce((prev, curr) => {
    prev.push({index: curr.index});
    prev.push({query: curr.query, _source: curr._source});
    return prev;
  }, []);

  return h(esclient.msearch({body}))
    .tap(h.log);
}

/**
 * Compose a page, recursively filling in all component references with
 * instance data.
 * @param  {object} pageData
 * @param  {object} locals
 * @return {Promise} - Resolves with composed page data
 */
function composePage(pageData, locals) {
  const layoutReference = pageData.layout,
    scopes = pageData._scopes,
    pageDataNoConf = references.omitPageConfiguration(pageData);

  return h(components.get(layoutReference))
    .map(layoutData => mapLayoutToPageData(pageDataNoConf, layoutData))
    .flatMap(fullData => resolveScopes(scopes, locals)
      .map(queryResults => ({fullData, queryResults})))
    .flatMap(({fullData, queryResults}) =>
      h(resolveComponentReferences(fullData, locals, queryResults)))
    .toPromise(bluebird);
}

module.exports.resolveComponentReferences = resolveComponentReferences;
module.exports.composePage = composePage;
