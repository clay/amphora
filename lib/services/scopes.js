'use strict';

const { getComponentName } = require('clayutils'),
  files = require('../files'),
  upgrade = require('./upgrade'),
  elasticsearch = require('elasticsearch'),
  h = require('highland'),
  _ = require('lodash'),
  db = require('./db'),
  esclient = new elasticsearch.Client({
    host: 'localhost:9200',
    apiVersion: '6.x'
  });

/**
 * Resolve all the specified scopes and stream and object mapping each
 * component URI to its Elastic results.
 * @param  {Object} scopes, mapping scope ID to arrays of URIs
 * @param {Object} locals
 * @return {Stream} of an object that map cmpt instace refs to Elastic results
 */
function resolveScopes(scopes, locals) {
  if (!scopes) return h.of({});
  return h.pairs(scopes)
    .flatMap(([key, scope]) => {
      let tasks, exclude;

      if (key === '_default') {
        tasks = scope.map(uri => ({uri, exclude: []}));
      } else {
        exclude = [];
        tasks = scope.map((uri, index) => ({uri, index, exclude}));
      }
      return h(tasks);
    })
    .flatMap(task => resolveCmptQuery(task.uri, locals)
      .map(query => Object.assign(task, {query}))
    )
    // group tasks by generation
    .reduce([], (acc, curr) => {
      acc[curr.index] = (acc[curr.index] || []).concat([curr]);
      return acc;
    })
    .sequence()
    .flatMap(executeGeneration)
    .reduce({}, _.extend);
}

/**
 * Add exclusions to the specified Elastic query.
 * @param {Object} query
 * @param {string[]} exclude array of document IDs
 * @return {Object}
 */
function addExclusions(query, exclude) {
  const mustnots = exclude.map(_id => ({term: {_id}}));

  if (exclude && exclude.length) {
    return _.set(query, 'body.query.bool.must_not',
      _.get(query, 'body.query.bool.must_not', []).concat(mustnots));
  }
  return query;
}

/**
 * Execute all the tasks in the generation, and stream results.
 * @param  {Object[]} generation An array of tasks within the same generation
 * @return {Stream} of {[uri]: Object[]} objects
 */
function executeGeneration(generation) {
  return h(generation)
    .map(({query, exclude}) => addExclusions(query, exclude))
    .reduce({body: []}, (prev, curr) => {
      prev.body.push(_.omit(curr, 'body'), curr.body);
      return prev;
    })
    .flatMap(streamMsearch)
    .pluck('responses')
    .map(responses => responses.map((i, index) => Object.assign(i, {index})))
    .sequence()
    .map(({status, index, hits}) => {
      const {uri, exclude} = generation[index];

      if (status === 200) {
        hits.hits.forEach(i => exclude.push(i._id));
        return {[uri]: {
          results: hits.hits.map(i => i._source)
        }};
      }
    })
    .errors((error) => h(generation)
      .map(({uri}) => ({[uri]: {results: [], error}}))
    );
}

function streamMsearch(opts) {
  return h(esclient.msearch(opts));
}

function streamSearch(query) {
  return h(esclient.search(query));
}

/**
 * Given a component URI and locals, stream the component's resolved Elastic
 * query.
 * @param  {string} uri
 * @param  {Object} locals
 * @return {Stream} resolved query object
 */
function resolveCmptQuery(uri, locals) {
  const name = getComponentName(uri),
    upgradeFnc = upgrade.init(uri, locals);

  return h.of(uri)
    .flatMap(uri => h(db.get(uri)))
    .map(JSON.parse)
    .flatMap(data => h(upgradeFnc(data)))
    .flatMap(data => {
      const componentModule = name && files.getComponentModule(name);

      return coerceStream(componentModule.query(uri, data, locals));
    });
}

/**
 * Fill the specified component with the results of its query.
 * @param  {string} uri
 * @param  {Object} data
 * @param  {Object} locals
 * @param  {Object} componentModule
 * @return {Sream} of the cmpt object with ._queryResults set
 */
function addQueryResults(uri, data, locals, componentModule) {
  return coerceStream(componentModule.query(uri, data, locals))
    .flatMap(streamSearch)
    .pluck('hits')
    .pluck('hits')
    .sequence()
    .pluck('_source')
    .collect()
    .map((results) => Object.assign(data, {_queryResults: results}))
    .errors(error => Object.assign(data, {
      _queryResults: [],
      _queryError: error
    }));
}

/**
 * Return the input as a stream, resolving it if it is a promise.
 * @param  {*} input
 * @return {Stream}
 */
function coerceStream(input) {
  return typeof input === 'object' && typeof input.then === 'function' ?
    h(input) : h.of(input);
}

module.exports.resolveScopes = resolveScopes;
module.exports.addQueryResults = addQueryResults;
