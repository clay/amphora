'use strict';
/* eslint quote-props: ["error", "as-needed", { "numbers": true }] */

const _ = require('lodash'),
  filename = __filename.split('/').pop().split('.').shift(),
  { getSchema } = require('./' + filename),
  sinon = require('sinon'),
  schema = require('../schema'),
  files = require('../files');

describe(_.startCase(filename), function () {
  let sandbox, fakeGetSchema, getCmptPath, getLayoutPath;

  beforeEach(function () {
    sandbox = sinon.sandbox.create();

    getCmptPath   = sandbox.stub();
    getLayoutPath = sandbox.stub();
    fakeGetSchema = sandbox.stub();

    schema.getSchema = fakeGetSchema;
    files.getComponentPath = getCmptPath;
    files.getLayoutPath = getLayoutPath;
  });

  afterEach(function () {
    sandbox.restore();
  });

  describe('getSchema', function () {
    it('calls getSchema for a component', function () {
      getCmptPath.returns('some/path');
      fakeGetSchema.returns(Promise.resolve());

      return getSchema('foo.com/_components/bar/instances/baz')
        .then(() => {
          sinon.assert.calledWith(getCmptPath, 'bar');
          sinon.assert.calledOnce(fakeGetSchema);
        });
    });

    it('calls getSchema for a layouts', function () {
      getCmptPath.returns('some/path');
      fakeGetSchema.returns(Promise.resolve());

      return getSchema('foo.com/_layouts/baz/instances/bar')
        .then(() => {
          sinon.assert.calledWith(getLayoutPath, 'baz');
          sinon.assert.calledOnce(fakeGetSchema);
        });
    });

  });
});
