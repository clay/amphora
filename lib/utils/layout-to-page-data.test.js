'use strict';

var _ = require('lodash'),
  expect = require('chai').expect,
  filename = __filename.split('/').pop().split('.').shift(),
  lib = require('./' + filename);

describe(_.startCase(filename), function () {

  it('replaces non-used page areas with empty arrays', function () {
    const mappedData = lib({ main: ['site/_components/foo/instance/bar'] }, { main: 'main', another: 'another' });

    expect(mappedData).to.eql({
      main: [{
        _ref: 'site/_components/foo/instance/bar'
      }],
      another: []
    });
  });
});
