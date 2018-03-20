'use strict';

const { getComponentName } = require('clayutils'),
  files = require('../files'),
  upgrade = require('./upgrade'),
  elasticsearch = require('elasticsearch'),
  h = require('highland'),
  _ = require('lodash'),
  db = require('./db'),
  esclient = new elasticsearch.Client({
    host: process.env.ELASTIC_HOST,
    apiVersion: '6.x'
  }),
  ELASTIC_PREFIX = process.env.ELASTIC_PREFIX;

function streamMsearch(opts) {
  return h(esclient.msearch(opts));
}

function streamSearch(query) {
  return h(esclient.search(query));
}

function streamGet(uri) {
  return h(db.get(uri));
}

/**
 * Resolve all the specified scopes, executing all Elasticsearch queries. Stream
 * objects mapping each component URI to its Elastic results.
 * @param  {Object} scopes, mapping scope ID to arrays of URIs
 * @param {Object} locals
 * @return {Stream} of an object that map cmpt instace refs to Elastic results
 */
function resolveScopes(scopes, locals) {
  if (!scopes) return h.of({});
  return scopesToTasks(scopes, locals)
    .through(tasksToGenerations)
    .flatMap(executeGeneration)
    .reduce({}, _.extend);
}

/**
 * Given a scopes object, stream tasks of the form {uri: string,
 * generation: number, exclude: Array}
 * @param  {Object} scopes mapping scope name to uris
 * @param  {Object} locals
 * @return {Stream} of tasks
 */
function scopesToTasks(scopes, locals) {
  return h.pairs(scopes)
    .map(([key, scopeUris]) => {
      let exclude;

      if (key === '_default') {
        return scopeUris.map(uri => ({uri, generation: 0}));
      }
      exclude = [];
      return scopeUris.map((uri, index) => ({uri, generation: index, exclude}));
    })
    .sequence()
    .flatMap(task => addQueryToTask(task, locals))
    .filter(task => task.query);
}

/**
 * Turn a stream of tasks {uri: string, generation: number,
 * exclude: Array} into an ordered stream of generations. A generation is an
 * array of tasks that can be executed with the same msearch.
 * @param  {Stream} taskStream
 * @return {Stream} of an array of generations
 */
function tasksToGenerations(taskStream) {
  return taskStream
    .reduce([], (acc, curr) => {
      acc[curr.generation] = (acc[curr.generation] || []).concat([curr]);
      return acc;
    })
    .sequence();
}

/**
 * Given a task of the form {uri: string}, generate its Elasticsearch query
 * with the instance data and component's "query" function. Assign the results
 * to the "query" prop.
 * @param {Object} task
 * @param {Object} locals
 * @return {Stream} of task
 */
function addQueryToTask(task, locals) {
  return resolveCmptQuery(task.uri, locals)
    .map(query => Object.assign(task, {query}));
}

/**
 * Add exclusions to the specified Elastic query.
 * @param {Object} query
 * @param {string[]} exclude array of document IDs
 * @return {Object}
 */
function addExclusions(query, exclude) {
  if (exclude && exclude.length) {
    const mustnots = exclude.map(_id => ({term: {_id}})),
      path = 'body.query.bool.must_not';

    return _.set(query, path, _.get(query, path, []).concat(mustnots));
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
      prev.body.push(
        _.omit(curr, 'body'),
        curr.body
      );
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

/**
 * Given a component URI and locals, stream the component's resolved Elastic
 * query.
 * @param  {string} uri
 * @param  {Object} locals
 * @return {Stream} resolved query object
 */
function resolveCmptQuery(uri, locals) {
  const queryFnc = files.getComponentModule(getComponentName(uri)).query,
    upgradeInstance = upgrade.init(uri, locals);

  if (!queryFnc) return h.of(null);
  return streamGet(uri)
    .map(JSON.parse)
    .flatMap(data => h(upgradeInstance(data)))
    .map(data => queryFnc(uri, data, locals))
    .flatMap(coerceStream)
    .tap(query => {
      if (query && query.index && ELASTIC_PREFIX) {
        query.index = `${ELASTIC_PREFIX}_${query.index}`;
      }
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
    .map(results => Object.assign(data, {_queryResults: results}))
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
