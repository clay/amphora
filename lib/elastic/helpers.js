'use strict';

const db = require('../services/db'),
  _ = require('lodash'),
  bluebird = require('bluebird'),
  refProp = '_ref',
  log = require('../services/log').withStandardPrefix(__dirname);

/**
 * Used to test types
 *
 * @type {Array}
 */
var genericTypeParsers = [{
  when: compare('string'),
  then: convertOpValuesPropertyToString
}, {
  when: compare('date'),
  then: convertOpValuesPropertyToDate
}, {
  when: compare('object'),
  then: function (propertyName, ops) {
    return ops;
  }
}];

// Required for `_.listDeepObjects`
_.mixin(require('lodash-ny-util'));

/**
 * A function which returns a function to help
 * compare two values. Pass in the value you exect
 * and then invoke the function with the value you're
 * testing as the new argument.
 *
 * @param  {String} expected
 * @return {Function}
 */
function compare(expected) {
  return function (comparison) {
    return expected === comparison;
  };
}

/**
 * @param {object} op
 * @returns {object}
 */
function parseOpValue(op) {
  try {
    if (_.isString(op.value)) {
      op.value = JSON.parse(op.value);
    }
  } catch (ex) {
    log('warn', op, ex.stack);
  }
  return op;
}

/**
 * Convert thing to string or [string] -- ES doesn't know the difference.
 * @param {*} value
 * @returns {string|[string]}
 */
function convertObjectToString(value) {
  if (_.isArray(value)) {
    value = _.map(value, function (property) {
      var innerValue;

      if (_.isPlainObject(property)) {
        innerValue = _.find(_.pickBy(property, _.isString));
      } else if (_.isString(property)) {
        innerValue = property;
      } else {
        log('warn', 'Bad String or [String] type', value);
      }

      return innerValue;
    });
  } else if (_.isPlainObject(value)) {

    // Special special!  An array of 'items' means this object is actually an array with properties (the array's items
    // are moved to the 'items' property
    if (_.isArray(value.items)) {
      value = convertObjectToString(value.items);
    } else {
      // take first property of the object that is a string
      value = _.find(_.pickBy(value, _.isString));
    }

  } else if (!_.isString(value)) {
    log('warn', 'Bad String or [String] type', value);
    value = null;
  }

  return value;
}

/**
 * If any of the properties that should be
 * strings are references, resolve them.
 *
 * @param {string} propertyName
 * @returns {Function}
 */
function resolveReferencesForPropertyOfStringType(propertyName) {
  return function (ops) {
    return bluebird.all(_.map(ops, function (op) {
      var result, value = op.value[propertyName];

      if (value !== null && value !== undefined) {
        if (value[refProp]) {
          result = db.get(value[refProp]).then(JSON.parse).then(function (referencedValue) {
            op.value[propertyName] = convertObjectToString(referencedValue);
            return op;
          });
        } else {
          op.value[propertyName] = convertObjectToString(value);
          result = op;
        }
      }

      return result;
    })).then(_.compact);
  };
}

/**
 * Storing null and undefined for a mapped property
 * confuses ES (doesn't error, but creates odd behavior).
 *
 * @param {string} propertyName
 * @returns {Function}
 */
function removeEmptyValuesForProperty(propertyName) {
  return function (ops) {
    _.each(ops, function (op) {
      var value = op.value[propertyName];

      // never give null or undefined to ES
      if (value === null || value === undefined) {
        delete op.value[propertyName];
      }
    });

    return ops;
  };
}

/**
 * @param {string} propertyName
 * @param {Array} ops
 * @returns {Promise}
 */
function convertOpValuesPropertyToString(propertyName, ops) {
  return bluebird.all(ops)
    .then(resolveReferencesForPropertyOfStringType(propertyName));
}


/**
 * Convert Redis batch operations to Elasticsearch batch operations
 *
 * @param {string} index
 * @param {string} type
 * @param {Array} ops
 * @returns {Array}
 */
function convertRedisBatchtoElasticBatch(index, type, ops) {
  let bulkOps = [];

  _.each(ops, function (op) {
    if (_.isString(op.value)) {
      op.value = JSON.parse(op.value);
    }

    if (op.type === 'put') {
      let indexOp = { _index: index, _type: type };

      // key is optional; if missing, an id will be generated that is unique across all shards
      if (op.key) {
        indexOp._id = op.key;
      }

      bulkOps.push({ index: indexOp },
        op.value
      );
    } else {
      log('warn', 'Unhandled batch operation:', op);
    }
  });
  return bulkOps;
}

/**
 * NOTE: Resolving references for dates is not implemented yet, because probably YAGNI.
 *
 * @param {string} propertyName
 * @param {Array} ops
 */
function convertOpValuesPropertyToDate(propertyName, ops) {
  _.each(ops, function (op) {
    var value = op.value[propertyName];

    if (value !== null && value !== undefined) {
      if (_.isString(value)) {
        value = new Date(value);
      } else if (!_.isDate(value)) {
        log('warn', 'Bad Date type', propertyName, op);
        value = null;
      }
    }

    // never give null or undefined to ES
    if (value === null || value === undefined) {
      delete op.value[propertyName];
    } else {
      op.value[propertyName] = value;
    }
  });
}

/**
 * The field types in a mapping have to match exactly, or ES will error.
 *
 * We don't care about the other properties.
 *
 * @param {Object} mapping
 * @param {Array} ops
 * @returns {Promise}
 */
function normalizeOpValuesWithMapping(mapping, ops) {
  var promises,
    properties = mapping.properties;

  promises = _.map(properties, function (property, propertyName) {
    var type = property.type,
      rule = _.find(genericTypeParsers, function (comparitor) {
        return comparitor.when(type);
      });

    if (rule) {
      rule.then(propertyName, ops);
    }
  });

  return bluebird.all(promises).return(ops);
}

/**
 * Iterate through the mappings and types and invoke a function
 * (which is passed in by the user) to filter the ops down to what
 * is necessary for a specific index.
 *
 * @param  {Array}    batchOps
 * @param  {Object}   mappings
 * @param  {String}   indexName
 * @param  {Function} fn
 * @return {Promise}
 */
function applyOpFilters(batchOps, mappings, indexName, fn) {
  return bluebird.all(_.map(_.pick(mappings, indexName), function (types) {
    return bluebird.all(_.map(types, function (mapping, typeName) {
      return bluebird.resolve({
        ops: fn(batchOps),
        mapping: mapping,
        typeName: typeName
      });
    }));
  }));
}

/**
 * Search indices are not allowed to reference things (at least currently), because when the results are returned in a
 * template, they will be composed just like any other component.  This might be beneficial behaviour later, but not now.
 * @param {object} op
 * @returns {object}
 */
function removeAllReferences(op) {
  _.each(_.listDeepObjects(op, refProp), function (obj) {
    delete obj[refProp];
  });
  return op;
}

module.exports.convertObjectToString = convertObjectToString;
module.exports.convertRedisBatchtoElasticBatch = convertRedisBatchtoElasticBatch;
module.exports.normalizeOpValuesWithMapping = normalizeOpValuesWithMapping;
module.exports.parseOpValue = parseOpValue;
module.exports.applyOpFilters = applyOpFilters;
module.exports.removeAllReferences = removeAllReferences;
module.exports.compare = compare;
// For testing
module.exports.removeEmptyValuesForProperty = removeEmptyValuesForProperty;
module.exports.resolveReferencesForPropertyOfStringType = resolveReferencesForPropertyOfStringType;
module.exports.convertOpValuesPropertyToDate = convertOpValuesPropertyToDate;

