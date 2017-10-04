'use strict';

const _ = require('lodash');

/**
 * @param {*} type
 * @param {*} value
 * @returns {string|undefined}  reason for error
 */
function validateValue(type, value) {
  let result;

  if (_.isString(value) && value[0] === '"') {
    result = 'Double-stringified value in batch operation';
  } else if (!_.isString(value) && type !== 'del') {
    result = 'Missing value in batch operation for type ' + type;
  }
  return result;
}

function assertValidValue(type, value) {
  let valueError = validateValue(type, value);

  if (valueError) {
    throw new Error('Invalid ' + type + ' value: ' + valueError);
  }
}

function validateBatchOp(op) {
  const errors = [];

  if (!_.isString(op.type)) {
    errors.push('Missing type in batch operation, can be "put" or "del"');
  }

  if (!_.isString(op.key)) {
    errors.push('Missing key in batch operation');
  }

  let valueError = validateValue(op.type, op.value);

  if (valueError) {
    errors.push(valueError);
  }

  return errors;
}

function validateBatchOps(ops) {
  return _.flatten(_.map(ops, validateBatchOp));
}

/**
 * @param {array} ops
 * @returns {array} ops
 * @throws if ops are invalid
 */
function assertValidBatchOps(ops) {
  const errors = validateBatchOps(ops);

  if (errors.length) {
    throw new Error('Invalid batch ops:\n  ' + errors.join('\n  '));
  }

  return ops;
}

module.exports.validateBatchOp = validateBatchOp;
module.exports.validateBatchOps = validateBatchOps;
module.exports.assertValidBatchOps = assertValidBatchOps;
module.exports.assertValidValue = assertValidValue;
