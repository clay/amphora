'use strict';

const _ = require('lodash'),
  filename = __filename.split('/').pop().split('.').shift(),
  schema = require('./' + filename),
  expect = require('chai').expect,
  sinon = require('sinon');

describe(_.startCase(filename), function () {
  let sandbox;

  beforeEach(function () {
    sandbox = sinon.sandbox.create();
  });

  afterEach(function () {
    sandbox.restore();
  });

  it('read basic schema with .yaml ext', function () {
    const textSchema = schema.getSchema('test/fixtures/text');

    expect(textSchema).to.deep.equal({
      name: {
        _type: 'text',
        _required: true
      },
      areas: {
        body: {
          _type: 'component-list'
        }
      }
    });
  });

  it('read basic schema with .yml ext', function () {
    const textSchema = schema.getSchema('test/fixtures/text2');

    expect(textSchema).to.deep.equal({
      name: {
        _type: 'text',
        _required: true
      },
      areas: {
        body: {
          _type: 'component-list'
        }
      }
    });
  });

  it('throws error when no schema found', function () {
    function getSchema() {
      return schema.getSchema('test/fixtures/not-found');
    }

    expect(getSchema).to.throw(/not found/);
  });
});
