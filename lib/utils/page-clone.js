'use strict';

const _ = require('lodash');

/**
 * Normalize cloned component data using optional schema directives.
 * Only top-level fields on the cloned instance are affected.
 *
 * @param {object} data
 * @param {object} componentSchema
 * @returns {{ data: object, conflictingFields: string[] }}
 */
function normalizePageCloneData(data, componentSchema = {}) {
  const resetOnPageClone = _.isPlainObject(componentSchema._resetOnPageClone) ? componentSchema._resetOnPageClone : {},
    omitOnPageClone = _.isArray(componentSchema._omitOnPageClone) ? _.filter(componentSchema._omitOnPageClone, _.isString) : [],
    normalizedData = _.assign({}, data, resetOnPageClone),
    conflictingFields = _.intersection(_.keys(resetOnPageClone), omitOnPageClone);

  if (!_.isPlainObject(data) || _.isEmpty(resetOnPageClone) && _.isEmpty(omitOnPageClone)) {
    return {
      data,
      conflictingFields: []
    };
  }

  _.each(omitOnPageClone, field => {
    delete normalizedData[field];
  });

  return {
    data: normalizedData,
    conflictingFields
  };
}

module.exports.normalizePageCloneData = normalizePageCloneData;
