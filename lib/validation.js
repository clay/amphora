'use strict';

const _ = require('lodash');

function validateBatchOp(op) {
  const errors = [];

  if (!_.isString(op.type)) {
    errors.push('Missing type in batch operation, can be "put" or "del"');
  }

  if (!_.isString(op.key)) {
    errors.push('Missing key in batch operation');
  }

  if (_.isString(op.value) && op.value[0] === '"') {
    errors.push('Double-stringified value in batch operation');
  } else if (!_.isString(op.value) && op.type !== 'del') {
    errors.push('Missing value in batch operation');
  }

  return errors;
}

function validateBatchOps(ops) {
  return _.flatten(_.map(ops, validateBatchOp));
}

/**
 * @param ops
 * @returns ops
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