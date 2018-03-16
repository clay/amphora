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

module.exports.resolveScopes = resolveScopes;
