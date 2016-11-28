'use strict';

var _ = require('lodash'),
  expect = require('chai').expect,
  filename = __filename.split('/').pop().split('.').shift(),
  lib = require('./' + filename);

describe(_.startCase(filename), function () {
  it('requires a module if it exists', function () {
    expect(lib(process.cwd() + '/test/fixtures/module-exists')).to.not.be.undefined;
  });

  it('resolves with no response if the module does not exist', function () {
    expect(lib(process.cwd() + 'fake/path')).to.be.undefined;
  });
});
