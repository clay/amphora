'use strict';

const db = require('../services/db'),
  _ = require('lodash'),
  bluebird = require('bluebird');

_.mixin(require('lodash-ny-util'));

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
    //   are moved to the 'items' property
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
 * If any of the properties that should be strings are references, resolve them.
 *
 * @param {string} propertyName
 * @returns {Function}
 */
function resolveReferencesForPropertyOfStringType(propertyName) {
  return function (ops) {
    return bluebird.all(_.map(ops, function (op) {
      var result, value = JSON.parse(op.value)[propertyName];

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
      } else {
        result = {};
        result[propertyName] = '';
      }

      return result;
    })).then(_.compact);
  };
}


/**
 * Storing null and undefined for a mapped property confuses ES (doesn't error, but creates odd behavior).
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
    // .then(removeEmptyValuesForProperty(propertyName));
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
      let indexOp = {_index: index, _type: type};

      // key is optional; if missing, an id will be generated that is unique across all shards
      if (op.key) {
        indexOp._id = op.key;
      }

      bulkOps.push(
        {index: indexOp},
        op.value
      );
    } else {
      log('warn', 'Unhandled batch operation:',  op);
    }
  });
  return bulkOps;
}

/**
 * The field types in a mapping have to match exactly, or ES will error.
 *
 * We don't care about the other properties.
 *
 * @param {object} mapping
 * @param {Array} ops
 * @returns {Array}
 */
function normalizeOpValuesWithMapping(mapping, ops) {
  var promises,
    properties = mapping.properties

  promises = _.map(properties, function (property, propertyName) {
    var type = property.type;

    switch (type) {
      case 'string':
        return convertOpValuesPropertyToString(propertyName, ops);
      case 'date':
        return convertOpValuesPropertyToDate(propertyName, ops);
      case 'object':
        return ops;
      default:
        log('warn', 'Unnormalized data type in mapping', type, mapping);
        break;
    }
  });

  return bluebird.all(promises).return(ops);
}

module.exports.convertRedisBatchtoElasticBatch = convertRedisBatchtoElasticBatch;
module.exports.normalizeOpValuesWithMapping = normalizeOpValuesWithMapping;
